'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';

import type { Database } from '@/lib/database.types';
import type { ActionResult, Class, ClassFormData, ClassTeacher, ClassMember, ClassSchedule } from '../types';

// =======================
// Supabase Helper
// =======================
async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        },
      },
    }
  );
}

async function getTenantIdOrThrow(sb: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userData.user.id)
    .single();

  if (profErr || !profile?.tenant_id) {
    throw new Error('TENANT_NOT_FOUND');
  }

  return { 
    tenantId: profile.tenant_id as string, 
    userId: userData.user.id,
    role: profile.role as string,
  };
}

// =======================
// Class CRUD
// =======================

/** 반 목록 조회 (교사/학생 카운트 포함) */
export async function listClasses(): Promise<Class[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  const { data, error } = await sb
    .from('classes')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[listClasses] error:', error);
    throw error;
  }

  return (data ?? []) as Class[];
}

/** 모든 반의 교사/학생 카운트 + 스케줄 조회 */
export async function getClassCounts(): Promise<{
  teacherCounts: Record<string, number>;
  studentCounts: Record<string, number>;
  schedulesMap: Record<string, ClassSchedule[]>;
}> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 교사 카운트 (class_teachers 기반)
  const { data: teacherData } = await sb
    .from('class_teachers')
    .select('class_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const teacherCounts: Record<string, number> = {};
  for (const t of teacherData ?? []) {
    if (t.class_id) {
      teacherCounts[t.class_id] = (teacherCounts[t.class_id] || 0) + 1;
    }
  }

  // 학생 카운트 (enrollment_schedule_assignments 기준)
  // 1. 모든 스케줄 조회
  const { data: allSchedules } = await sb
    .from('class_schedules')
    .select('id, class_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const scheduleToClass: Record<string, string> = {};
  for (const s of allSchedules ?? []) {
    if (s.class_id) {
      scheduleToClass[s.id] = s.class_id;
    }
  }

  // 2. 활성 배정에서 학생 카운트 (반별 distinct)
  const { data: assignmentData } = await sb
    .from('enrollment_schedule_assignments')
    .select('student_id, class_schedule_id')
    .eq('tenant_id', tenantId)
    .is('end_date', null)
    .is('deleted_at', null);

  const studentsByClass: Record<string, Set<string>> = {};
  for (const a of assignmentData ?? []) {
    const classId = scheduleToClass[a.class_schedule_id];
    if (classId && a.student_id) {
      if (!studentsByClass[classId]) {
        studentsByClass[classId] = new Set();
      }
      studentsByClass[classId].add(a.student_id);
    }
  }

  const studentCounts: Record<string, number> = {};
  for (const [classId, students] of Object.entries(studentsByClass)) {
    studentCounts[classId] = students.size;
  }

  // 스케줄 조회 (class_schedules 기반)
  const { data: scheduleData } = await sb
    .from('class_schedules')
    .select('id, class_id, day_of_week, start_time, end_time')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('day_of_week')
    .order('start_time');

  const schedulesMap: Record<string, ClassSchedule[]> = {};
  for (const s of scheduleData ?? []) {
    if (s.class_id) {
      if (!schedulesMap[s.class_id]) {
        schedulesMap[s.class_id] = [];
      }
      schedulesMap[s.class_id].push({
        id: s.id,
        dayOfWeek: s.day_of_week,
        startTime: s.start_time?.slice(0, 5) || '00:00',
        endTime: s.end_time?.slice(0, 5) || '00:00',
      });
    }
  }

  return { teacherCounts, studentCounts, schedulesMap };
}

/** 반 생성 */
export async function createClass(formData: ClassFormData): Promise<ActionResult<{ id: string }>> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    // 권한 체크: 원장만 가능
    if (role !== 'owner') {
      return { ok: false, message: '반 생성 권한이 없습니다' };
    }

    const name = formData.name.trim();
    if (!name) {
      return { ok: false, message: '반 이름을 입력하세요' };
    }

    // 중복 이름 체크
    const { data: existing } = await sb
      .from('classes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', name)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: '이미 같은 이름의 반이 있습니다' };
    }

    const { data, error } = await sb
      .from('classes')
      .insert({
        tenant_id: tenantId,
        name,
        color: formData.color || '#6366F1',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[createClass] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true, data: { id: data.id } };
  } catch (e: any) {
    console.error('[createClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 반 수정 */
export async function updateClass(classId: string, formData: Partial<ClassFormData>): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    // 권한 체크
    if (role !== 'owner') {
      return { ok: false, message: '반 수정 권한이 없습니다' };
    }

    const updateData: Record<string, string> = {};

    // 이름 업데이트
    if (formData.name !== undefined) {
      const name = formData.name.trim();
      if (!name) {
        return { ok: false, message: '반 이름을 입력하세요' };
      }

      // 중복 이름 체크 (자기 자신 제외)
      const { data: existing } = await sb
        .from('classes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', name)
        .neq('id', classId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        return { ok: false, message: '이미 같은 이름의 반이 있습니다' };
      }

      updateData.name = name;
    }

    // 색상 업데이트
    if (formData.color !== undefined) {
      updateData.color = formData.color;
    }

    if (Object.keys(updateData).length === 0) {
      return { ok: false, message: '변경할 내용이 없습니다' };
    }

    const { error } = await sb
      .from('classes')
      .update(updateData)
      .eq('id', classId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[updateClass] error:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 반 삭제 (소프트 삭제) */
export async function deleteClass(classId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    // 권한 체크
    if (role !== 'owner') {
      return { ok: false, message: '반 삭제 권한이 없습니다' };
    }

    const { error } = await sb
      .from('classes')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', classId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[deleteClass] error:', error);
      return { ok: false, message: error.message };
    }

    // 관련 교사 배정도 비활성화 (tenant_id 필터 추가)
    await sb
      .from('class_teachers')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('class_id', classId);

    // 관련 스케줄의 학생 배정 종료 (enrollment_schedule_assignments)
    const { data: classSchedules } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId);

    if (classSchedules && classSchedules.length > 0) {
      const scheduleIds = classSchedules.map(s => s.id);
      const today = new Date().toISOString().split('T')[0];
      
      await sb
        .from('enrollment_schedule_assignments')
        .update({ end_date: today, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .in('class_schedule_id', scheduleIds)
        .is('end_date', null);
    }

    // 레거시: class_members도 비활성화 (하위 호환)
    await sb
      .from('class_members')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('class_id', classId);

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[deleteClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Teacher Assignment
// =======================

/** 반에 배정된 교사 목록 */
export async function getClassTeachers(classId: string): Promise<ClassTeacher[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  const { data, error } = await sb
    .from('class_teachers')
    .select(`
      *,
      teacher:profiles!class_teachers_teacher_id_fkey(id, name, display_name)
    `)
    .eq('class_id', classId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error) {
    console.error('[getClassTeachers] error:', error);
    throw error;
  }

  return (data ?? []) as ClassTeacher[];
}

/** 배정 가능한 교사 목록 */
export async function getAvailableTeachers(): Promise<{ id: string; name: string; display_name: string }[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  const { data, error } = await sb
    .from('profiles')
    .select('id, name, display_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'teacher')
    .is('deleted_at', null);

  if (error) {
    console.error('[getAvailableTeachers] error:', error);
    throw error;
  }

  return data ?? [];
}

/** 교사 배정 */
export async function assignTeacher(
  classId: string, 
  teacherId: string, 
  role: 'primary' | 'assistant' = 'primary'
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role: userRole } = await getTenantIdOrThrow(sb);

    if (userRole !== 'owner') {
      return { ok: false, message: '교사 배정 권한이 없습니다' };
    }

    // 이미 배정되어 있는지 확인 (비활성 포함)
    const { data: existing } = await sb
      .from('class_teachers')
      .select('id, is_active')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .is('deleted_at', null)
      .maybeSingle();

    // 활성 상태로 이미 있으면 에러
    if (existing?.is_active) {
      return { ok: false, message: '이미 배정된 교사입니다' };
    }

    // 비활성 상태로 있으면 재활성화
    if (existing && !existing.is_active) {
      const { error: updateError } = await sb
        .from('class_teachers')
        .update({
          is_active: true,
          role,
          assigned_at: new Date().toISOString(),
          unassigned_at: null,
        })
        .eq('id', existing.id)
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('[assignTeacher] reactivate error:', updateError);
        return { ok: false, message: updateError.message };
      }

      revalidatePath('/dashboard/admin/classes');
      return { ok: true };
    }

    // 새로 생성
    const { error } = await sb
      .from('class_teachers')
      .insert({
        tenant_id: tenantId,
        class_id: classId,
        teacher_id: teacherId,
        role,
        is_active: true,
        assigned_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[assignTeacher] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[assignTeacher] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 교사 배정 해제 */
export async function unassignTeacher(classId: string, teacherId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '교사 배정 해제 권한이 없습니다' };
    }

    const { error } = await sb
      .from('class_teachers')
      .update({
        is_active: false,
        unassigned_at: new Date().toISOString(),
      })
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[unassignTeacher] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[unassignTeacher] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Student Enrollment
// =======================

/** 반에 등록된 학생 목록 */
export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 1. 해당 반의 스케줄 ID들 조회
  const { data: schedules } = await sb
    .from('class_schedules')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (!schedules || schedules.length === 0) {
    return [];
  }

  const scheduleIds = schedules.map(s => s.id);

  // 2. 해당 스케줄에 배정된 학생들 조회 (중복 제거)
  const { data, error } = await sb
    .from('enrollment_schedule_assignments')
    .select(`
      id,
      student_id,
      class_schedule_id,
      start_date,
      students (id, name, display_code)
    `)
    .eq('tenant_id', tenantId)
    .in('class_schedule_id', scheduleIds)
    .is('end_date', null)
    .is('deleted_at', null);

  if (error) {
    console.error('[getClassMembers] error:', error);
    throw error;
  }

  // 3. 학생별로 중복 제거 (한 학생이 여러 스케줄에 있을 수 있음)
  const studentMap = new Map<string, ClassMember>();
  
  for (const row of data ?? []) {
    if (!row.student_id || studentMap.has(row.student_id)) continue;
    
    const student = row.students as { id: string; name: string; display_code: string | null } | null;
    if (!student) continue;

    studentMap.set(row.student_id, {
      id: row.id,  // assignment id
      tenant_id: tenantId,
      class_id: classId,
      student_id: row.student_id,
      is_active: true,
      enrolled_at: row.start_date,
      student: {
        id: student.id,
        name: student.name,
        display_code: student.display_code ?? '',
      },
    } as ClassMember);
  }

  return Array.from(studentMap.values());
}

/** 등록 가능한 학생 목록 (특정 반에 미등록된 학생) */
export async function getAvailableStudents(classId: string): Promise<{ id: string; name: string; display_code: string }[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 1. 해당 반의 스케줄 ID들 조회
  const { data: schedules } = await sb
    .from('class_schedules')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .is('deleted_at', null);

  let enrolledIds: string[] = [];

  if (schedules && schedules.length > 0) {
    const scheduleIds = schedules.map(s => s.id);

    // 2. 해당 스케줄에 이미 배정된 학생 ID들
    const { data: enrolled } = await sb
      .from('enrollment_schedule_assignments')
      .select('student_id')
      .eq('tenant_id', tenantId)
      .in('class_schedule_id', scheduleIds)
      .is('end_date', null)
      .is('deleted_at', null);

    enrolledIds = [...new Set((enrolled ?? []).map((e) => e.student_id).filter((id): id is string => !!id))];
  }

  // 3. 전체 학생 중 미등록 학생
  let query = sb
    .from('students')
    .select('id, name, display_code')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (enrolledIds.length > 0) {
    const inList = enrolledIds.map((id) => `"${id}"`).join(',');
    query = query.not('id', 'in', `(${inList})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getAvailableStudents] error:', error);
    throw error;
  }

  return data ?? [];
}

/** 학생 등록 */
export async function enrollStudent(classId: string, studentId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role, userId } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 등록 권한이 없습니다' };
    }

    // 1. 해당 반의 모든 스케줄 조회
    const { data: schedules } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (!schedules || schedules.length === 0) {
      return { ok: false, message: '해당 반에 스케줄이 없습니다. 먼저 시간표를 설정해주세요.' };
    }

    const scheduleIds = schedules.map(s => s.id);

    // 2. 이미 배정되어 있는지 확인
    const { data: existing } = await sb
      .from('enrollment_schedule_assignments')
      .select('id, class_schedule_id, end_date')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .in('class_schedule_id', scheduleIds)
      .is('deleted_at', null);

    const activeAssignments = (existing ?? []).filter(e => !e.end_date);
    
    if (activeAssignments.length > 0) {
      return { ok: false, message: '이미 등록된 학생입니다' };
    }

    // 3. 종료된 배정이 있으면 재활성화, 없으면 새로 생성
    const today = new Date().toISOString().split('T')[0];
    const existingScheduleIds = new Set((existing ?? []).map(e => e.class_schedule_id));

    for (const scheduleId of scheduleIds) {
      const endedAssignment = (existing ?? []).find(e => e.class_schedule_id === scheduleId && e.end_date);
      
      if (endedAssignment) {
        // 재활성화
        await sb
          .from('enrollment_schedule_assignments')
          .update({
            end_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', endedAssignment.id);
      } else if (!existingScheduleIds.has(scheduleId)) {
        // 새로 생성
        await sb
          .from('enrollment_schedule_assignments')
          .insert({
            tenant_id: tenantId,
            student_id: studentId,
            class_schedule_id: scheduleId,
            start_date: today,
            created_by: userId,
          });
      }
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[enrollStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 학생 등록 해제 */
export async function unenrollStudent(classId: string, studentId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 등록 해제 권한이 없습니다' };
    }

    // 1. 해당 반의 모든 스케줄 조회
    const { data: schedules } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (!schedules || schedules.length === 0) {
      return { ok: true };  // 스케줄 없으면 할 일 없음
    }

    const scheduleIds = schedules.map(s => s.id);
    const today = new Date().toISOString().split('T')[0];

    // 2. 해당 학생의 배정 종료 (end_date 설정)
    const { error } = await sb
      .from('enrollment_schedule_assignments')
      .update({
        end_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .in('class_schedule_id', scheduleIds)
      .is('end_date', null);

    if (error) {
      console.error('[unenrollStudent] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[unenrollStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Bulk Operations
// =======================

/** 여러 학생 일괄 등록 */
export async function enrollStudentsBulk(classId: string, studentIds: string[]): Promise<ActionResult<{ count: number }>> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role, userId } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 등록 권한이 없습니다' };
    }

    if (studentIds.length === 0) {
      return { ok: false, message: '등록할 학생을 선택하세요' };
    }

    // 1. 해당 반의 모든 스케줄 조회
    const { data: schedules } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (!schedules || schedules.length === 0) {
      return { ok: false, message: '해당 반에 스케줄이 없습니다. 먼저 시간표를 설정해주세요.' };
    }

    const scheduleIds = schedules.map(s => s.id);

    // 2. 기존 배정 조회 (활성/종료 모두)
    const { data: existingAssignments } = await sb
      .from('enrollment_schedule_assignments')
      .select('id, student_id, class_schedule_id, end_date')
      .eq('tenant_id', tenantId)
      .in('class_schedule_id', scheduleIds)
      .in('student_id', studentIds)
      .is('deleted_at', null);

    // 학생+스케줄 조합별로 상태 파악
    const activeSet = new Set<string>();  // 이미 활성인 조합
    const endedMap = new Map<string, string>();  // 종료된 조합 → assignment id

    for (const a of existingAssignments ?? []) {
      const key = `${a.student_id}-${a.class_schedule_id}`;
      if (!a.end_date) {
        activeSet.add(key);
      } else {
        endedMap.set(key, a.id);
      }
    }

    // 3. 이미 모든 스케줄에 활성 배정된 학생 제외
    const studentsToProcess: string[] = [];
    for (const studentId of studentIds) {
      const allActive = scheduleIds.every(scheduleId => 
        activeSet.has(`${studentId}-${scheduleId}`)
      );
      if (!allActive) {
        studentsToProcess.push(studentId);
      }
    }

    if (studentsToProcess.length === 0) {
      return { ok: false, message: '모든 학생이 이미 등록되어 있습니다' };
    }

    const today = new Date().toISOString().split('T')[0];

    // 4. 종료된 배정 재활성화
    const toReactivate: string[] = [];
    for (const studentId of studentsToProcess) {
      for (const scheduleId of scheduleIds) {
        const key = `${studentId}-${scheduleId}`;
        if (endedMap.has(key)) {
          toReactivate.push(endedMap.get(key)!);
        }
      }
    }

    if (toReactivate.length > 0) {
      await sb
        .from('enrollment_schedule_assignments')
        .update({
          end_date: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', toReactivate);
    }

    // 5. 새로 생성할 배정
    const toCreate: {
      tenant_id: string;
      student_id: string;
      class_schedule_id: string;
      start_date: string;
      created_by: string;
    }[] = [];

    for (const studentId of studentsToProcess) {
      for (const scheduleId of scheduleIds) {
        const key = `${studentId}-${scheduleId}`;
        // 활성도 아니고 종료된 것도 없으면 새로 생성
        if (!activeSet.has(key) && !endedMap.has(key)) {
          toCreate.push({
            tenant_id: tenantId,
            student_id: studentId,
            class_schedule_id: scheduleId,
            start_date: today,
            created_by: userId,
          });
        }
      }
    }

    if (toCreate.length > 0) {
      const { error } = await sb
        .from('enrollment_schedule_assignments')
        .insert(toCreate);

      if (error) {
        console.error('[enrollStudentsBulk] error:', error);
        return { ok: false, message: error.message };
      }
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true, data: { count: studentsToProcess.length } };
  } catch (e: any) {
    console.error('[enrollStudentsBulk] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Schedule Management
// =======================

/** 반의 스케줄 목록 조회 */
export async function getClassSchedules(classId: string): Promise<ClassSchedule[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  const { data, error } = await sb
    .from('class_schedules')
    .select('id, day_of_week, start_time, end_time')
    .eq('tenant_id', tenantId)
    .eq('class_id', classId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('day_of_week')
    .order('start_time');

  if (error) {
    console.error('[getClassSchedules] error:', error);
    throw error;
  }

  return (data ?? []).map(s => ({
    id: s.id,
    dayOfWeek: s.day_of_week,
    startTime: s.start_time?.slice(0, 5) || '00:00',
    endTime: s.end_time?.slice(0, 5) || '00:00',
  }));
}

/** 스케줄 추가 */
export async function addClassSchedule(
  classId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '스케줄 추가 권한이 없습니다' };
    }

    // 중복 체크
    const { data: existing } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('day_of_week', dayOfWeek)
      .eq('start_time', startTime)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: '같은 요일/시간에 이미 스케줄이 있습니다' };
    }

    const { error } = await sb
      .from('class_schedules')
      .insert({
        tenant_id: tenantId,
        class_id: classId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        is_active: true,
      });

    if (error) {
      console.error('[addClassSchedule] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[addClassSchedule] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 스케줄 삭제 */
export async function removeClassSchedule(scheduleId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '스케줄 삭제 권한이 없습니다' };
    }

    const { error } = await sb
      .from('class_schedules')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[removeClassSchedule] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[removeClassSchedule] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 스케줄 일괄 추가 */
export async function addClassSchedulesBulk(
  classId: string,
  schedules: { dayOfWeek: number; startTime: string; endTime: string }[]
): Promise<ActionResult<{ created: ClassSchedule[] }>> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '스케줄 추가 권한이 없습니다' };
    }

    if (schedules.length === 0) {
      return { ok: false, message: '추가할 스케줄이 없습니다' };
    }

    // 중복 체크
    const { data: existing } = await sb
      .from('class_schedules')
      .select('day_of_week, start_time')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null);

    const existingSet = new Set(
      (existing || []).map(e => `${e.day_of_week}-${e.start_time}`)
    );

    // 중복 제외하고 추가할 것만
    const toInsert = schedules.filter(
      s => !existingSet.has(`${s.dayOfWeek}-${s.startTime}`)
    );

    if (toInsert.length === 0) {
      return { ok: false, message: '이미 등록된 스케줄입니다' };
    }

    const rows = toInsert.map(s => ({
      tenant_id: tenantId,
      class_id: classId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
      is_active: true,
    }));

    const { data, error } = await sb
      .from('class_schedules')
      .insert(rows)
      .select('id, day_of_week, start_time, end_time');

    if (error) {
      console.error('[addClassSchedulesBulk] error:', error);
      return { ok: false, message: error.message };
    }

    const created: ClassSchedule[] = (data || []).map(s => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time?.slice(0, 5) || '00:00',
      endTime: s.end_time?.slice(0, 5) || '00:00',
    }));

    revalidatePath('/dashboard/admin/classes');
    return { ok: true, data: { created } };
  } catch (e: any) {
    console.error('[addClassSchedulesBulk] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}
