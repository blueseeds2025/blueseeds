'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';

import type { Database } from '@/lib/supabase/types';
import type { ActionResult, Student, StudentFormData, StudentWithDetails, StudentEnrollment, ClassInfo } from '../types';

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
// Student CRUD
// =======================

/** 학생의 수강 반 정보 (간단) */
export type StudentClassInfo = {
  class_id: string;
  class_name: string;
  class_color: string;
};

/** 학생 목록 조회 (수강 반 포함) */
export async function listStudents(): Promise<(Student & { classes: StudentClassInfo[] })[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 1. 학생 목록 조회
  const { data: students, error } = await sb
    .from('students')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[listStudents] error:', error);
    throw error;
  }

  if (!students || students.length === 0) {
    return [];
  }

  // 2. 스케줄 → 반 매핑 조회
  const { data: schedules } = await sb
    .from('class_schedules')
    .select(`
      id,
      class:classes(id, name, color)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const scheduleToClass: Record<string, { id: string; name: string; color: string }> = {};
  for (const s of schedules ?? []) {
    const cls = s.class as any;
    if (cls) {
      scheduleToClass[s.id] = { id: cls.id, name: cls.name, color: cls.color };
    }
  }

  // 3. 학생들의 활성 배정 조회 (enrollment_schedule_assignments)
  const studentIds = students.map(s => s.id);
  const { data: assignments } = await sb
    .from('enrollment_schedule_assignments')
    .select('student_id, class_schedule_id')
    .eq('tenant_id', tenantId)
    .in('student_id', studentIds)
    .is('end_date', null)
    .is('deleted_at', null);

  // 4. 학생별 반 정보 매핑 (중복 제거)
  const studentClassMap = new Map<string, Map<string, StudentClassInfo>>();
  for (const a of assignments ?? []) {
    if (!a.student_id || !a.class_schedule_id) continue;
    
    const classInfo = scheduleToClass[a.class_schedule_id];
    if (!classInfo) continue;

    if (!studentClassMap.has(a.student_id)) {
      studentClassMap.set(a.student_id, new Map());
    }
    
    // 반 ID 기준으로 중복 제거
    if (!studentClassMap.get(a.student_id)!.has(classInfo.id)) {
      studentClassMap.get(a.student_id)!.set(classInfo.id, {
        class_id: classInfo.id,
        class_name: classInfo.name,
        class_color: classInfo.color,
      });
    }
  }

  // 5. 학생 데이터에 반 정보 추가
  return students.map(s => ({
    ...(s as Student),
    classes: studentClassMap.has(s.id) 
      ? Array.from(studentClassMap.get(s.id)!.values())
      : [],
  }));
}

/** 학생 상세 조회 (수강 반 포함) */
export async function getStudentDetails(studentId: string): Promise<StudentWithDetails | null> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 1. 학생 기본 정보
  const { data: student, error: studentErr } = await sb
    .from('students')
    .select('*')
    .eq('id', studentId)
    .eq('tenant_id', tenantId)
    .single();

  if (studentErr || !student) {
    console.error('[getStudentDetails] student error:', studentErr);
    return null;
  }

  // 2. 스케줄 → 반 매핑
  const { data: schedules } = await sb
    .from('class_schedules')
    .select(`
      id,
      class:classes(id, name, color)
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const scheduleToClass: Record<string, { id: string; name: string; color: string }> = {};
  for (const s of schedules ?? []) {
    const cls = s.class as any;
    if (cls) {
      scheduleToClass[s.id] = { id: cls.id, name: cls.name, color: cls.color };
    }
  }

  // 3. 학생의 배정 목록 (enrollment_schedule_assignments)
  const { data: assignments, error: assignErr } = await sb
    .from('enrollment_schedule_assignments')
    .select('id, class_schedule_id, start_date, end_date')
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('start_date', { ascending: false });

  if (assignErr) {
    console.error('[getStudentDetails] assignment error:', assignErr);
  }

  // 4. 반별로 그룹화 (한 반에 여러 스케줄 있을 수 있음)
  const classEnrollmentMap = new Map<string, {
    class_id: string;
    class_name: string;
    class_color: string;
    start_date: string;
    is_active: boolean;
  }>();

  for (const a of assignments ?? []) {
    const classInfo = scheduleToClass[a.class_schedule_id];
    if (!classInfo) continue;

    const isActive = !a.end_date;
    
    // 이미 있으면 active 상태만 업데이트 (하나라도 active면 active)
    if (classEnrollmentMap.has(classInfo.id)) {
      const existing = classEnrollmentMap.get(classInfo.id)!;
      if (isActive) {
        existing.is_active = true;
      }
    } else {
      classEnrollmentMap.set(classInfo.id, {
        class_id: classInfo.id,
        class_name: classInfo.name,
        class_color: classInfo.color,
        start_date: a.start_date,
        is_active: isActive,
      });
    }
  }

  const enrollments: StudentEnrollment[] = Array.from(classEnrollmentMap.values()).map(e => ({
    id: e.class_id,  // class_id를 id로 사용
    class_id: e.class_id,
    class_name: e.class_name,
    class_color: e.class_color,
    enrolled_at: e.start_date,
    is_active: e.is_active,
  }));

  const currentClassCount = enrollments.filter(e => e.is_active).length;

  return {
    ...(student as Student),
    enrollments,
    currentClassCount,
  };
}

/** 학생 생성 */
export async function createStudent(formData: StudentFormData): Promise<ActionResult<{ id: string }>> {
  const MAX_RETRY = 3;
  
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    // 권한 체크: 원장만 가능
    if (role !== 'owner') {
      return { ok: false, message: '학생 등록 권한이 없습니다' };
    }

    const name = formData.name.trim();
    if (!name) {
      return { ok: false, message: '학생 이름을 입력하세요' };
    }

    // 재시도 루프 (동시성 충돌 대비)
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      // display_code 순번 자동 생성 (S001, S002, ...)
      const { data: lastStudent } = await sb
        .from('students')
        .select('display_code')
        .eq('tenant_id', tenantId)
        .like('display_code', 'S%')
        .order('display_code', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (lastStudent?.display_code) {
        const match = lastStudent.display_code.match(/^S(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const displayCode = `S${String(nextNumber).padStart(3, '0')}`;

      const { data, error } = await sb
        .from('students')
        .insert({
          tenant_id: tenantId,
          name,
          phone: formData.parent_phone?.trim() || formData.phone?.trim() || null,
          parent_phone: formData.parent_phone?.trim() || null,
          student_phone: formData.student_phone?.trim() || null,
          display_code: displayCode,
          school: formData.school?.trim() || null,
          grade: formData.grade ?? null,
          address: formData.address?.trim() || null,
          memo: formData.memo?.trim() || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (!error) {
        // 성공
        revalidatePath('/dashboard/admin/students');
        return { ok: true, data: { id: data.id } };
      }

      // unique 충돌이면 재시도 (code: 23505)
      if (error.code === '23505' && attempt < MAX_RETRY - 1) {
        console.log(`[createStudent] display_code 충돌, 재시도 ${attempt + 1}/${MAX_RETRY}`);
        continue;
      }

      // 다른 에러거나 마지막 시도면 실패
      console.error('[createStudent] error:', error);
      return { ok: false, message: error.message };
    }

    return { ok: false, message: '학생 등록에 실패했습니다. 다시 시도해주세요.' };
  } catch (e: any) {
    console.error('[createStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 학생 수정 */
export async function updateStudent(studentId: string, formData: StudentFormData): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    // 권한 체크
    if (role !== 'owner') {
      return { ok: false, message: '학생 수정 권한이 없습니다' };
    }

    const name = formData.name.trim();
    if (!name) {
      return { ok: false, message: '학생 이름을 입력하세요' };
    }

    // display_code 중복 체크 (자기 자신 제외)
    if (formData.display_code) {
      const { data: existing } = await sb
        .from('students')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('display_code', formData.display_code.trim())
        .neq('id', studentId)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        return { ok: false, message: '이미 사용 중인 표시 코드입니다' };
      }
    }

    const { error } = await sb
      .from('students')
      .update({
        name,
        phone: formData.parent_phone?.trim() || formData.phone?.trim() || null,  // 보호자 연락처 (호환성)
        parent_phone: formData.parent_phone?.trim() || null,
        student_phone: formData.student_phone?.trim() || null,
        display_code: formData.display_code?.trim(),
        school: formData.school?.trim() || null,
        grade: formData.grade ?? null,
        address: formData.address?.trim() || null,
        memo: formData.memo?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[updateStudent] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[updateStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 학생 아카이브 (퇴원 처리) */
export async function archiveStudent(studentId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 퇴원 처리 권한이 없습니다' };
    }

    const { error } = await sb
      .from('students')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[archiveStudent] error:', error);
      return { ok: false, message: error.message };
    }

    // 해당 학생의 모든 스케줄 배정 종료 (enrollment_schedule_assignments)
    const today = new Date().toISOString().split('T')[0];
    await sb
      .from('enrollment_schedule_assignments')
      .update({ 
        end_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('end_date', null);

    // 레거시: class_members도 비활성화 (하위 호환)
    await sb
      .from('class_members')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId);

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[archiveStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 학생 복구 (재원 처리) */
export async function restoreStudent(studentId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 복구 권한이 없습니다' };
    }

    const { error } = await sb
      .from('students')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[restoreStudent] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[restoreStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 학생 삭제 (소프트 삭제 - 완전 삭제) */
export async function deleteStudent(studentId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 삭제 권한이 없습니다' };
    }

    const { error } = await sb
      .from('students')
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq('id', studentId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[deleteStudent] error:', error);
      return { ok: false, message: error.message };
    }

    // 해당 학생의 모든 스케줄 배정 종료 (enrollment_schedule_assignments)
    const today = new Date().toISOString().split('T')[0];
    await sb
      .from('enrollment_schedule_assignments')
      .update({ 
        end_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .is('end_date', null);

    // 레거시: class_members도 삭제 (하위 호환)
    await sb
      .from('class_members')
      .update({ 
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId);

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[deleteStudent] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Enrollment (반 등록)
// =======================

/** 등록 가능한 반 목록 */
export async function getAvailableClasses(): Promise<ClassInfo[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  const { data, error } = await sb
    .from('classes')
    .select('id, name, color')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[getAvailableClasses] error:', error);
    throw error;
  }

  return (data ?? []) as ClassInfo[];
}

/** 학생을 반에 등록 */
export async function enrollStudentToClass(studentId: string, classId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role, userId } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '반 등록 권한이 없습니다' };
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

    const activeCount = (existing ?? []).filter(e => !e.end_date).length;
    
    if (activeCount > 0) {
      return { ok: false, message: '이미 등록된 반입니다' };
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

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[enrollStudentToClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 학생을 반에서 제거 */
export async function unenrollStudentFromClass(studentId: string, classId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '반 등록 해제 권한이 없습니다' };
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
      console.error('[unenrollStudentFromClass] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[unenrollStudentFromClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 반 이동 (기존 반에서 빼고 새 반에 등록) */
export async function moveStudentToClass(
  studentId: string, 
  fromClassId: string, 
  toClassId: string
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role, userId } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '반 이동 권한이 없습니다' };
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. 기존 반의 스케줄 조회 및 배정 종료
    const { data: fromSchedules } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', fromClassId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (fromSchedules && fromSchedules.length > 0) {
      const fromScheduleIds = fromSchedules.map(s => s.id);
      
      await sb
        .from('enrollment_schedule_assignments')
        .update({
          end_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('student_id', studentId)
        .in('class_schedule_id', fromScheduleIds)
        .is('end_date', null);
    }

    // 2. 새 반의 스케줄 조회
    const { data: toSchedules } = await sb
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', toClassId)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (!toSchedules || toSchedules.length === 0) {
      return { ok: false, message: '이동할 반에 스케줄이 없습니다. 먼저 시간표를 설정해주세요.' };
    }

    const toScheduleIds = toSchedules.map(s => s.id);

    // 3. 새 반에 기존 배정이 있는지 확인
    const { data: existing } = await sb
      .from('enrollment_schedule_assignments')
      .select('id, class_schedule_id, end_date')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .in('class_schedule_id', toScheduleIds)
      .is('deleted_at', null);

    const existingScheduleIds = new Set((existing ?? []).map(e => e.class_schedule_id));

    // 4. 종료된 배정 재활성화 또는 새로 생성
    for (const scheduleId of toScheduleIds) {
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
      } else if (!existingScheduleIds.has(scheduleId) || (existing ?? []).find(e => e.class_schedule_id === scheduleId)?.end_date) {
        // 새로 생성 (기존에 없거나 종료된 경우)
        const activeExists = (existing ?? []).some(e => e.class_schedule_id === scheduleId && !e.end_date);
        if (!activeExists) {
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
    }

    revalidatePath('/dashboard/admin/students');
    return { ok: true };
  } catch (e: any) {
    console.error('[moveStudentToClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// 검색
// =======================

/** 학생 검색 */
export async function searchStudents(query: string): Promise<Student[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  const searchTerm = `%${query.trim()}%`;

  const { data, error } = await sb
    .from('students')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .or(`name.ilike.${searchTerm},school.ilike.${searchTerm},display_code.ilike.${searchTerm}`)
    .order('name', { ascending: true })
    .limit(50);

  if (error) {
    console.error('[searchStudents] error:', error);
    throw error;
  }

  return (data ?? []) as Student[];
}

// =======================
// Enrollment History (반 이력)
// =======================

export type EnrollmentHistoryItem = {
  id: string;
  class_id: string;
  class_name: string;
  class_color: string;
  start_date: string;
  end_date: string | null;
  created_by_name: string | null;
  action: 'enrolled' | 'moved_out' | 'moved_in' | 'unenrolled';
};

/** 학생의 반 이동 이력 조회 */
export async function getStudentEnrollmentHistory(
  studentId: string
): Promise<ActionResult<EnrollmentHistoryItem[]>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 1. 스케줄 → 반 매핑 조회
    const { data: schedules } = await sb
      .from('class_schedules')
      .select(`
        id,
        class_id,
        classes (id, name, color)
      `)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    const scheduleToClass: Record<string, { id: string; name: string; color: string }> = {};
    for (const s of schedules ?? []) {
      const cls = s.classes as { id: string; name: string; color: string } | null;
      if (cls) {
        scheduleToClass[s.id] = { id: cls.id, name: cls.name, color: cls.color };
      }
    }

    // 2. 학생의 모든 배정 이력 조회 (종료된 것 포함)
    const { data: assignments, error } = await sb
      .from('enrollment_schedule_assignments')
      .select(`
        id,
        class_schedule_id,
        start_date,
        end_date,
        created_by,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[getStudentEnrollmentHistory] error:', error);
      return { ok: false, message: error.message };
    }

    // 3. created_by 유저 정보 조회
    const creatorIds = [...new Set((assignments ?? []).map(a => a.created_by).filter(Boolean))];
    let creatorMap: Record<string, string> = {};
    
    if (creatorIds.length > 0) {
      const { data: creators } = await sb
        .from('profiles')
        .select('id, name, display_name')
        .in('id', creatorIds);
      
      for (const c of creators ?? []) {
        creatorMap[c.id] = c.display_name || c.name || '알 수 없음';
      }
    }

    // 4. 반별로 그룹화하여 이력 생성
    // 같은 반의 여러 스케줄은 하나로 합침
    const classHistoryMap = new Map<string, {
      class_id: string;
      class_name: string;
      class_color: string;
      start_date: string;
      end_date: string | null;
      created_by: string | null;
    }[]>();

    for (const a of assignments ?? []) {
      const classInfo = scheduleToClass[a.class_schedule_id];
      if (!classInfo) continue;

      const key = `${classInfo.id}-${a.start_date}-${a.end_date || 'active'}`;
      
      if (!classHistoryMap.has(key)) {
        classHistoryMap.set(key, []);
      }
      
      classHistoryMap.get(key)!.push({
        class_id: classInfo.id,
        class_name: classInfo.name,
        class_color: classInfo.color,
        start_date: a.start_date,
        end_date: a.end_date,
        created_by: a.created_by,
      });
    }

    // 5. 이력 아이템 생성
    const historyItems: EnrollmentHistoryItem[] = [];
    const processedKeys = new Set<string>();

    for (const [key, items] of classHistoryMap) {
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      const first = items[0];
      const creatorName = first.created_by ? creatorMap[first.created_by] || null : null;

      // 등록 이벤트
      historyItems.push({
        id: `${first.class_id}-${first.start_date}-in`,
        class_id: first.class_id,
        class_name: first.class_name,
        class_color: first.class_color,
        start_date: first.start_date,
        end_date: first.end_date,
        created_by_name: creatorName,
        action: 'enrolled',
      });

      // 종료 이벤트 (있으면)
      if (first.end_date) {
        historyItems.push({
          id: `${first.class_id}-${first.end_date}-out`,
          class_id: first.class_id,
          class_name: first.class_name,
          class_color: first.class_color,
          start_date: first.start_date,
          end_date: first.end_date,
          created_by_name: creatorName,
          action: 'unenrolled',
        });
      }
    }

    // 6. 날짜순 정렬 (최신순)
    historyItems.sort((a, b) => {
      const dateA = a.action === 'unenrolled' ? a.end_date! : a.start_date;
      const dateB = b.action === 'unenrolled' ? b.end_date! : b.start_date;
      return dateB.localeCompare(dateA);
    });

    return { ok: true, data: historyItems };
  } catch (e: any) {
    console.error('[getStudentEnrollmentHistory] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Recent Class Transfers (대시보드용 - 반 이동만)
// =======================

export type RecentClassTransfer = {
  id: string;
  studentName: string;
  fromClassName: string;
  fromClassColor: string;
  toClassName: string;
  toClassColor: string;
  date: string;
  changedByName: string;
};

/** 최근 반 이동 내역 조회 (대시보드용) */
export async function getRecentClassTransfers(
  days: number = 7
): Promise<ActionResult<RecentClassTransfer[]>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 기준 날짜 (N일 전)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceDateStr = sinceDate.toISOString().split('T')[0];

    // 1. 최근 변동 조회
    const { data: assignments, error } = await sb
      .from('enrollment_schedule_assignments')
      .select(`
        id,
        student_id,
        class_schedule_id,
        start_date,
        end_date,
        created_by,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(`start_date.gte.${sinceDateStr},end_date.gte.${sinceDateStr}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('[getRecentClassTransfers] error:', error);
      return { ok: false, message: error.message };
    }

    if (!assignments || assignments.length === 0) {
      return { ok: true, data: [] };
    }

    // 2. 스케줄 → 반 매핑
    const scheduleIds = [...new Set(assignments.map(a => a.class_schedule_id))];
    const { data: schedules } = await sb
      .from('class_schedules')
      .select('id, class_id, classes(id, name, color)')
      .in('id', scheduleIds);

    const scheduleToClass: Record<string, { id: string; name: string; color: string }> = {};
    for (const s of schedules ?? []) {
      const cls = s.classes as { id: string; name: string; color: string } | null;
      if (cls) {
        scheduleToClass[s.id] = cls;
      }
    }

    // 3. 학생 정보
    const studentIds = [...new Set(assignments.map(a => a.student_id))];
    const { data: students } = await sb
      .from('students')
      .select('id, name')
      .in('id', studentIds);

    const studentMap: Record<string, string> = {};
    for (const s of students ?? []) {
      studentMap[s.id] = s.name;
    }

    // 4. 변경자 정보
    const creatorIds = [...new Set(assignments.map(a => a.created_by).filter(Boolean))];
    let creatorMap: Record<string, string> = {};
    
    if (creatorIds.length > 0) {
      const { data: creators } = await sb
        .from('profiles')
        .select('id, name, display_name')
        .in('id', creatorIds);
      
      for (const c of creators ?? []) {
        creatorMap[c.id] = c.display_name || c.name || '알 수 없음';
      }
    }

    // 5. 날짜+학생별로 이벤트 그룹화 (이동 감지용)
    type EventGroup = {
      date: string;
      studentId: string;
      studentName: string;
      changedByName: string;
      enrolled: { classId: string; className: string; classColor: string }[];
      unenrolled: { classId: string; className: string; classColor: string }[];
    };
    
    const eventGroups: Record<string, EventGroup> = {};

    for (const a of assignments) {
      const classInfo = scheduleToClass[a.class_schedule_id];
      if (!classInfo) continue;

      const studentName = studentMap[a.student_id] || '알 수 없음';
      const changedByName = a.created_by ? creatorMap[a.created_by] || '알 수 없음' : '시스템';

      // 등록 이벤트
      if (a.start_date >= sinceDateStr) {
        const key = `${a.start_date}-${a.student_id}`;
        if (!eventGroups[key]) {
          eventGroups[key] = {
            date: a.start_date,
            studentId: a.student_id,
            studentName,
            changedByName,
            enrolled: [],
            unenrolled: [],
          };
        }
        if (!eventGroups[key].enrolled.some(e => e.classId === classInfo.id)) {
          eventGroups[key].enrolled.push({
            classId: classInfo.id,
            className: classInfo.name,
            classColor: classInfo.color,
          });
        }
      }

      // 종료 이벤트
      if (a.end_date && a.end_date >= sinceDateStr) {
        const key = `${a.end_date}-${a.student_id}`;
        if (!eventGroups[key]) {
          eventGroups[key] = {
            date: a.end_date,
            studentId: a.student_id,
            studentName,
            changedByName,
            enrolled: [],
            unenrolled: [],
          };
        }
        if (!eventGroups[key].unenrolled.some(e => e.classId === classInfo.id)) {
          eventGroups[key].unenrolled.push({
            classId: classInfo.id,
            className: classInfo.name,
            classColor: classInfo.color,
          });
        }
      }
    }

    // 6. 이동만 추출 (같은 날 한 반 종료 + 다른 반 등록)
    const transfers: RecentClassTransfer[] = [];

    for (const group of Object.values(eventGroups)) {
      if (group.enrolled.length > 0 && group.unenrolled.length > 0) {
        for (const from of group.unenrolled) {
          for (const to of group.enrolled) {
            if (from.classId !== to.classId) {
              transfers.push({
                id: `${group.date}-${group.studentId}-${from.classId}-${to.classId}`,
                studentName: group.studentName,
                fromClassName: from.className,
                fromClassColor: from.classColor,
                toClassName: to.className,
                toClassColor: to.classColor,
                date: group.date,
                changedByName: group.changedByName,
              });
            }
          }
        }
      }
    }

    // 7. 날짜순 정렬 (최신순)
    transfers.sort((a, b) => b.date.localeCompare(a.date));
    
    return { ok: true, data: transfers };
  } catch (e: any) {
    console.error('[getRecentClassTransfers] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Helper
// =======================

function generateDisplayCode(name: string): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${name}${randomNum}`;
}
