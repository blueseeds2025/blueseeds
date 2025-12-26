'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';

import type { Database } from '@/lib/database.types';
import type { ActionResult, Class, ClassFormData, ClassTeacher, ClassMember } from '../types';

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

/** 반 목록 조회 */
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
export async function updateClass(classId: string, formData: ClassFormData): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    // 권한 체크
    if (role !== 'owner') {
      return { ok: false, message: '반 수정 권한이 없습니다' };
    }

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

    const { error } = await sb
      .from('classes')
      .update({
        name,
        color: formData.color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', classId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[updateClass] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true };
  } catch (e: any) {
    console.error('[updateClass] fatal:', e);
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

    // 관련 교사 배정도 비활성화
    await sb
      .from('class_teachers')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
      .eq('class_id', classId);

    // 관련 학생 등록도 비활성화
    await sb
      .from('class_members')
      .update({ is_active: false, deleted_at: new Date().toISOString() })
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

    // 이미 배정되어 있는지 확인
    const { data: existing } = await sb
      .from('class_teachers')
      .select('id')
      .eq('class_id', classId)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: '이미 배정된 교사입니다' };
    }

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

  const { data, error } = await sb
    .from('class_members')
    .select(`
      *,
      student:students!class_members_student_id_fkey(id, name, display_code)
    `)
    .eq('class_id', classId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error) {
    console.error('[getClassMembers] error:', error);
    throw error;
  }

  return (data ?? []) as ClassMember[];
}

/** 등록 가능한 학생 목록 (특정 반에 미등록된 학생) */
export async function getAvailableStudents(classId: string): Promise<{ id: string; name: string; display_code: string }[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 이미 등록된 학생 ID 목록
  const { data: enrolled } = await sb
    .from('class_members')
    .select('student_id')
    .eq('class_id', classId)
    .eq('is_active', true)
    .is('deleted_at', null);

  const enrolledIds = (enrolled ?? []).map((e) => e.student_id);

  // 전체 학생 중 미등록 학생
  let query = sb
    .from('students')
    .select('id, name, display_code')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (enrolledIds.length > 0) {
    query = query.not('id', 'in', `(${enrolledIds.join(',')})`);
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
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 등록 권한이 없습니다' };
    }

    // 이미 등록되어 있는지 확인
    const { data: existing } = await sb
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: '이미 등록된 학생입니다' };
    }

    const { error } = await sb
      .from('class_members')
      .insert({
        tenant_id: tenantId,
        class_id: classId,
        student_id: studentId,
        is_active: true,
        enrolled_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[enrollStudent] error:', error);
      return { ok: false, message: error.message };
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

    const { error } = await sb
      .from('class_members')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
      })
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId);

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
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '학생 등록 권한이 없습니다' };
    }

    if (studentIds.length === 0) {
      return { ok: false, message: '등록할 학생을 선택하세요' };
    }

    // 이미 등록된 학생 필터링
    const { data: existing } = await sb
      .from('class_members')
      .select('student_id')
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .in('student_id', studentIds);

    const existingIds = new Set((existing ?? []).map((e) => e.student_id));
    const newStudentIds = studentIds.filter((id) => !existingIds.has(id));

    if (newStudentIds.length === 0) {
      return { ok: false, message: '모든 학생이 이미 등록되어 있습니다' };
    }

    const rows = newStudentIds.map((studentId) => ({
      tenant_id: tenantId,
      class_id: classId,
      student_id: studentId,
      is_active: true,
      enrolled_at: new Date().toISOString(),
    }));

    const { error } = await sb.from('class_members').insert(rows);

    if (error) {
      console.error('[enrollStudentsBulk] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/classes');
    return { ok: true, data: { count: newStudentIds.length } };
  } catch (e: any) {
    console.error('[enrollStudentsBulk] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}
