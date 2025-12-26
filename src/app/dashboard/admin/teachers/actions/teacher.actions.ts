'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';

import type { Database } from '@/lib/database.types';
import type { ActionResult, Teacher, TeacherWithDetails, FeedPermission, AssignedClass, FeedOptionSet, ClassInfo } from '../types';

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
  const { tenantId } = await getTenantIdOrThrow(sb);

  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('role', 'teacher')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[listTeachers] error:', error);
    throw error;
  }

  return (data ?? []) as Teacher[];
}

/** 교사 상세 정보 조회 (담당 반 + 피드 권한) */
export async function getTeacherDetails(teacherId: string): Promise<TeacherWithDetails | null> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 1. 교사 기본 정보
  const { data: teacher, error: teacherErr } = await sb
    .from('profiles')
    .select('*')
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

  // 4. 교사의 피드 권한 목록
  const { data: permissions, error: permErr } = await sb
    .from('teacher_feed_permissions')
    .select('id, option_set_id, is_allowed')
    .eq('teacher_id', teacherId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);

  if (permErr) {
    console.error('[getTeacherDetails] permissions error:', permErr);
  }

  // 권한 맵 생성
  const permissionMap = new Map<string, { id: string; is_allowed: boolean }>();
  for (const p of permissions ?? []) {
    permissionMap.set(p.option_set_id, { id: p.id, is_allowed: p.is_allowed });
  }

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
    ...(teacher as Teacher),
    assignedClasses,
    feedPermissions,
  };
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
      .update({ color, updated_at: new Date().toISOString() })
      .eq('id', teacherId)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[updateTeacherColor] error:', error);
      return { ok: false, message: error.message };
    }

    revalidatePath('/dashboard/admin/teachers');
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

    // 기존 권한 삭제 (soft delete)
    await sb
      .from('teacher_feed_permissions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('teacher_id', teacherId)
      .eq('tenant_id', tenantId);

    // 새 권한 추가
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
      return { ok: false, message: '이미 배정된 반입니다' };
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
  const { tenantId } = await getTenantIdOrThrow(sb);

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
