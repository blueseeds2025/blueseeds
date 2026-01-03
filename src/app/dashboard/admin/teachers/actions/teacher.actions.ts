'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';

import type { Database } from '@/lib/supabase/types';
import type { ActionResult, Teacher, TeacherWithDetails, TeacherPermissions, FeedPermission, AssignedClass, FeedOptionSet, ClassInfo } from '../types';

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
// Teacher List
// =======================

/** 교사 목록 조회 */
export async function listTeachers(): Promise<Teacher[]> {
  const sb = await supabaseServer();
  const { tenantId, role } = await getTenantIdOrThrow(sb);

  // owner만 접근 가능
  if (role !== 'owner') {
    throw new Error('권한이 없습니다');
  }

  const { data, error } = await sb
    .from('profiles')
    .select('id, tenant_id, name, display_name, calendar_color, role, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('role', 'teacher')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[listTeachers] error:', error);
    throw error;
  }

  // calendar_color를 color로 매핑
  return (data ?? []).map((t: any) => ({
    ...t,
    color: t.calendar_color || '#6366F1',
  })) as Teacher[];
}

/** 교사 상세 정보 조회 (담당 반 + 피드 권한) */
export async function getTeacherDetails(teacherId: string): Promise<TeacherWithDetails | null> {
  const sb = await supabaseServer();
  const { tenantId, role } = await getTenantIdOrThrow(sb);

  // owner만 접근 가능
  if (role !== 'owner') {
    return null;
  }

  // 1. 교사 기본 정보 (필요한 컬럼만)
  const { data: teacher, error: teacherErr } = await sb
    .from('profiles')
    .select('id, tenant_id, name, display_name, calendar_color, role, created_at, updated_at')
    .eq('id', teacherId)
    .eq('tenant_id', tenantId)
    .eq('role', 'teacher')
    .single();

  if (teacherErr || !teacher) {
    console.error('[getTeacherDetails] teacher error:', teacherErr);
    return null;
  }

  // 2. 담당 반 목록
  const { data: classAssignments, error: classErr } = await sb
    .from('class_teachers')
    .select(`
      id,
      class_id,
      role,
      is_active,
      class:classes!class_teachers_class_id_fkey(id, name, color)
    `)
    .eq('teacher_id', teacherId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (classErr) {
    console.error('[getTeacherDetails] class error:', classErr);
  }

  const assignedClasses: AssignedClass[] = (classAssignments ?? []).map((ca: any) => ({
    id: ca.id,
    class_id: ca.class_id,
    class_name: ca.class?.name ?? '알 수 없음',
    class_color: ca.class?.color ?? '#6366F1',
    role: ca.role,
    is_active: ca.is_active,
  }));

  // 3. 피드 항목 목록 (전체)
  const { data: allOptionSets, error: optionSetErr } = await sb
    .from('feed_option_sets')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('is_active', true);

  if (optionSetErr) {
    console.error('[getTeacherDetails] optionSet error:', optionSetErr);
  }

  // 4. 교사의 기능 권한 조회 (teacher_permissions)
  const { data: teacherPerm, error: teacherPermErr } = await sb
    .from('teacher_permissions')
    .select('id, can_view_reports')
    .eq('teacher_id', teacherId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  if (teacherPermErr) {
    console.error('[getTeacherDetails] teacherPerm error:', teacherPermErr);
  }

  // 기능 권한 (없으면 기본값)
  const permissions: TeacherPermissions = {
    id: teacherPerm?.id ?? null,
    can_view_reports: teacherPerm?.can_view_reports ?? true,
  };

  // 5. 교사의 피드 권한 목록 (Premium)
  const { data: feedPerms, error: permErr } = await sb
    .from('teacher_feed_permissions')
    .select('id, option_set_id, is_allowed')
    .eq('teacher_id', teacherId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (permErr) {
    console.error('[getTeacherDetails] feedPerms error:', permErr);
  }

  // 권한 맵 생성
  const permissionMap = new Map<string, { id: string; is_allowed: boolean }>();
  for (const p of feedPerms ?? []) {
permissionMap.set(p.option_set_id, { id: p.id, is_allowed: p.is_allowed ?? true });  }

  // 피드 권한 목록 생성 (전체 항목 기준, 권한 없으면 기본값 true)
  const feedPermissions: FeedPermission[] = (allOptionSets ?? []).map((os: any) => {
    const perm = permissionMap.get(os.id);
    return {
      id: perm?.id ?? null,
      option_set_id: os.id,
      option_set_name: os.name,
      is_allowed: perm?.is_allowed ?? true, // 기본값: 허용
    };
  });

  return {
    ...teacher,
    color: (teacher as any).calendar_color || '#6366F1',
    assignedClasses,
    permissions,
    feedPermissions,
  } as TeacherWithDetails;
}

// =======================
// Teacher Update
// =======================

/** 교사 색상 변경 */
export async function updateTeacherColor(teacherId: string, color: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '권한이 없습니다' };
    }

    const { error } = await sb
      .from('profiles')
      .update({ calendar_color: color, updated_at: new Date().toISOString() })
      .eq('id', teacherId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[updateTeacherColor] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/teachers');
    revalidatePath('/dashboard/timetable');
    return { ok: true };
  } catch (e: any) {
    console.error('[updateTeacherColor] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Feed Permissions
// =======================

/** 피드 항목 권한 저장 (일괄) */
export async function saveFeedPermissions(
  teacherId: string,
  permissions: { option_set_id: string; is_allowed: boolean }[]
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '권한이 없습니다' };
    }

    // 새 권한 먼저 추가 (실패 시 기존 데이터 유지)
    if (permissions.length > 0) {
      const rows = permissions.map((p) => ({
        tenant_id: tenantId,
        teacher_id: teacherId,
        option_set_id: p.option_set_id,
        is_allowed: p.is_allowed,
      }));

      const { error: insertErr } = await sb
        .from('teacher_feed_permissions')
        .insert(rows);

      if (insertErr) {
        console.error('[saveFeedPermissions] insert error:', insertErr);
        return { ok: false, message: insertErr.message };
      }
    }

    // insert 성공 후 기존 권한 삭제 (soft delete)
    // 방금 추가한 것들 제외하고 삭제
    const newOptionSetIds = permissions.map(p => p.option_set_id);
    
    let deleteQuery = sb
      .from('teacher_feed_permissions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('teacher_id', teacherId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
    
    // 새로 추가한 option_set_id는 삭제에서 제외
    if (newOptionSetIds.length > 0) {
      // 최근 1초 내에 생성된 것은 삭제하지 않음 (방금 추가한 것)
      const oneSecondAgo = new Date(Date.now() - 1000).toISOString();
      deleteQuery = deleteQuery.lt('created_at', oneSecondAgo);
    }

    await deleteQuery;

    revalidatePath('/dashboard/admin/teachers');
    return { ok: true };
  } catch (e: any) {
    console.error('[saveFeedPermissions] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Class Assignment (반 배정)
// =======================

/** 배정 가능한 반 목록 */
export async function getAvailableClasses(): Promise<ClassInfo[]> {
  const sb = await supabaseServer();
  const { tenantId, role } = await getTenantIdOrThrow(sb);

  // owner만 접근 가능
  if (role !== 'owner') {
    throw new Error('권한이 없습니다');
  }

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

/** 반 배정 */
export async function assignClass(
  teacherId: string,
  classId: string,
  role: 'primary' | 'assistant' = 'primary'
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role: userRole } = await getTenantIdOrThrow(sb);

    if (userRole !== 'owner') {
      return { ok: false, message: '권한이 없습니다' };
    }

    // 이미 배정되어 있는지 확인 (비활성 포함, tenant_id 추가)
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
      return { ok: false, message: '이미 배정된 반입니다' };
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
        console.error('[assignClass] reactivate error:', updateError);
        return { ok: false, message: updateError.message };
      }

      revalidatePath('/dashboard/admin/teachers');
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
      console.error('[assignClass] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/teachers');
    return { ok: true };
  } catch (e: any) {
    console.error('[assignClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 반 배정 해제 */
export async function unassignClass(teacherId: string, classId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '권한이 없습니다' };
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
      console.error('[unassignClass] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/teachers');
    return { ok: true };
  } catch (e: any) {
    console.error('[unassignClass] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Feed Option Sets (읽기용)
// =======================

/** 전체 피드 항목 목록 */
export async function listFeedOptionSets(): Promise<FeedOptionSet[]> {
  const sb = await supabaseServer();
  const { tenantId, role } = await getTenantIdOrThrow(sb);

  // owner만 접근 가능
  if (role !== 'owner') {
    throw new Error('권한이 없습니다');
  }

  const { data, error } = await sb
    .from('feed_option_sets')
    .select('id, name, category, is_scored')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[listFeedOptionSets] error:', error);
    throw error;
  }

  return (data ?? []) as FeedOptionSet[];
}

// =======================
// Teacher Permissions (기능 권한)
// =======================

/** 리포트 조회 권한 저장 */
export async function updateTeacherReportPermission(
  teacherId: string,
  canViewReports: boolean
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId, role } = await getTenantIdOrThrow(sb);

    if (role !== 'owner') {
      return { ok: false, message: '권한이 없습니다' };
    }

    // 기존 레코드 확인
    const { data: existing } = await sb
      .from('teacher_permissions')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      // 업데이트
      const { error } = await sb
        .from('teacher_permissions')
        .update({ 
          can_view_reports: canViewReports,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('[updateTeacherReportPermission] update error:', error);
        return { ok: false, message: error.message };
      }
    } else {
      // 새로 생성
      const { error } = await sb
        .from('teacher_permissions')
        .insert({
          tenant_id: tenantId,
          teacher_id: teacherId,
          can_view_reports: canViewReports,
        });

      if (error) {
        console.error('[updateTeacherReportPermission] insert error:', error);
        return { ok: false, message: error.message };
      }
    }

    revalidatePath('/dashboard/admin/teachers');
    return { ok: true };
  } catch (e: any) {
    console.error('[updateTeacherReportPermission] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

/** 선생님 본인의 기능 권한 조회 (teacher용) */
export async function getMyPermissions(): Promise<ActionResult<TeacherPermissions>> {
  try {
    const sb = await supabaseServer();
    const { tenantId, userId, role } = await getTenantIdOrThrow(sb);

    // teacher만 사용 (owner는 모든 권한 있음)
    if (role !== 'teacher') {
      return { 
        ok: true, 
        data: { 
          id: null, 
          can_view_reports: true,  // owner는 항상 true
        } 
      };
    }

    const { data, error } = await sb
      .from('teacher_permissions')
      .select('id, can_view_reports')
      .eq('teacher_id', userId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('[getMyPermissions] error:', error);
      return { ok: false, message: error.message };
    }

    return {
      ok: true,
      data: {
        id: data?.id ?? null,
        can_view_reports: data?.can_view_reports ?? true,  // 기본값 true
      },
    };
  } catch (e: any) {
    console.error('[getMyPermissions] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}
