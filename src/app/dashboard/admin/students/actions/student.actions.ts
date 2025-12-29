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

  // 2. 학생들의 수강 반 정보 조회
  const studentIds = students.map(s => s.id);
  const { data: memberships } = await sb
    .from('class_members')
    .select(`
      student_id,
      class:classes!class_members_class_id_fkey(id, name, color)
    `)
    .in('student_id', studentIds)
    .eq('is_active', true)
    .is('deleted_at', null);

  // 3. 학생별 반 정보 매핑
  const studentClassMap = new Map<string, StudentClassInfo[]>();
  for (const m of memberships || []) {
    if (!m.class) continue;
    const cls = m.class as any;
if (!m.student_id || !studentClassMap.has(m.student_id)) {      studentClassMap.set(m.student_id!, []);
    }
   studentClassMap.get(m.student_id!)!.push({
      class_id: cls.id,
      class_name: cls.name,
      class_color: cls.color,
    });
  }

  // 4. 학생 데이터에 반 정보 추가
  return students.map(s => ({
    ...(s as Student),
    classes: studentClassMap.get(s.id) || [],
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

  // 2. 수강 반 목록 (class_members)
  const { data: memberships, error: memberErr } = await sb
    .from('class_members')
    .select(`
      id,
      class_id,
      enrolled_at,
      is_active,
      class:classes!class_members_class_id_fkey(id, name, color)
    `)
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('enrolled_at', { ascending: false });

  if (memberErr) {
    console.error('[getStudentDetails] membership error:', memberErr);
  }

  const enrollments: StudentEnrollment[] = (memberships ?? []).map((m: any) => ({
    id: m.id,
    class_id: m.class_id,
    class_name: m.class?.name ?? '알 수 없음',
    class_color: m.class?.color ?? '#6366F1',
    enrolled_at: m.enrolled_at,
    is_active: m.is_active,
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

    // 해당 학생의 모든 반 등록도 비활성화
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

    // 해당 학생의 모든 반 등록도 삭제
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
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '반 등록 권한이 없습니다' };
    }

    // 이미 등록되어 있는지 확인
    const { data: existing } = await sb
      .from('class_members')
      .select('id, is_active')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        return { ok: false, message: '이미 등록된 반입니다' };
      }
      // 비활성 상태면 다시 활성화
      const { error } = await sb
        .from('class_members')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        return { ok: false, message: error.message };
      }
    } else {
      // 신규 등록
      const { error } = await sb
        .from('class_members')
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          class_id: classId,
          is_active: true,
          enrolled_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[enrollStudentToClass] error:', error);
        return { ok: false, message: error.message };
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

    const { error } = await sb
      .from('class_members')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .eq('tenant_id', tenantId);

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
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '반 이동 권한이 없습니다' };
    }

    // 1. 기존 반에서 제거
    await sb
      .from('class_members')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('class_id', fromClassId)
      .eq('tenant_id', tenantId);

    // 2. 새 반에 등록
    const { data: existing } = await sb
      .from('class_members')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_id', toClassId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      // 기존 레코드 활성화
      await sb
        .from('class_members')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // 신규 등록
      const { error } = await sb
        .from('class_members')
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          class_id: toClassId,
          is_active: true,
          enrolled_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[moveStudentToClass] error:', error);
        return { ok: false, message: error.message };
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
// Helper
// =======================

function generateDisplayCode(name: string): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${name}${randomNum}`;
}
