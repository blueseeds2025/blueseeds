// ============================================================================
// 통합 설정 Server Actions
// ============================================================================
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  SettingsData,
  SetupHealth,
  SetupHealthItem,
  UpdateAcademyInput,
  UpdateReportSettingsInput,
  MessageTone,
  WeeklyTemplateType,
  MonthlyTemplateType,
} from '@/types/settings.types';

// ----------------------------------------------------------------------------
// 타입 정의
// ----------------------------------------------------------------------------
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

// 🆕 운영 모드 타입
export type OperationMode = 'solo' | 'team';

// ----------------------------------------------------------------------------
// 헬퍼: 인증 및 테넌트 확인
// ----------------------------------------------------------------------------
async function getAuthContext() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: '로그인이 필요합니다' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: '프로필을 찾을 수 없습니다' };
  }

  // 관리자 권한 체크
  if (profile.role !== 'admin' && profile.role !== 'owner') {
    return { error: '설정 페이지 접근 권한이 없습니다' };
  }

  return { supabase, user, profile };
}

// ============================================================================
// 1. 전체 설정 데이터 조회
// ============================================================================
export async function getSettingsData(): Promise<ActionResult<SettingsData>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // 1. 학원 정보 조회
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, display_name, phone, curriculum, message_tone, plan')
      .eq('id', profile.tenant_id)
      .single();

    if (tenantError || !tenant) {
      return { ok: false, message: '학원 정보를 찾을 수 없습니다' };
    }

    // 2. 리포트 설정 조회 (없으면 기본값)
    const { data: reportSettings } = await supabase
      .from('report_settings')
      .select('id, tenant_id, strength_threshold, weakness_threshold, weekly_template_type, monthly_template_type')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .single();

    // 3. 통계 데이터 조회
    const [teacherResult, studentResult, feedSetResult, unmappedResult] = await Promise.all([
      // 선생님 수
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .in('role', ['teacher', 'admin', 'owner']),
      
      // 학생 수
      supabase
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null),
      
      // 피드 세트 수
      supabase
        .from('feed_option_sets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .is('deleted_at', null),
      
      // stats_category 미지정 개수
      supabase
        .from('feed_option_sets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .eq('is_in_weekly_stats', true)
        .is('stats_category', null)
        .is('deleted_at', null),
    ]);

    const settingsData: SettingsData = {
      academy: {
        id: tenant.id,
        name: tenant.name,
        display_name: tenant.display_name,
        phone: tenant.phone,
        curriculum: tenant.curriculum,
        message_tone: (tenant.message_tone as MessageTone) || 'friendly',
        plan: tenant.plan || 'basic',
      },
      report: reportSettings || {
        id: '',
        tenant_id: profile.tenant_id,
        strength_threshold: 80,
        weakness_threshold: 75,
        weekly_template_type: 1 as WeeklyTemplateType,
        monthly_template_type: 1 as MonthlyTemplateType,
      },
      stats: {
        teacherCount: teacherResult.count || 0,
        studentCount: studentResult.count || 0,
        feedSetCount: feedSetResult.count || 0,
        unmappedCategoryCount: unmappedResult.count || 0,
      },
    };

    return { ok: true, data: settingsData };
  } catch (error) {
    console.error('getSettingsData error:', error);
    return { ok: false, message: '설정을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 2. Setup Health 체크
// ============================================================================
export async function getSetupHealth(): Promise<ActionResult<SetupHealth>> {
  try {
    const result = await getSettingsData();
    if (!result.ok) {
      return { ok: false, message: result.message };
    }

    const { academy, report, stats } = result.data;
    const items: SetupHealthItem[] = [];

    // 1. 학원 기본정보
    items.push({
      key: 'academy_info',
      label: '학원 정보',
      status: academy.display_name ? 'complete' : 'error',
      message: academy.display_name ? undefined : '학원명을 입력해주세요',
    });

    // 2. 연락처
    items.push({
      key: 'phone',
      label: '연락처',
      status: academy.phone ? 'complete' : 'warning',
      message: academy.phone ? undefined : '연락처를 입력하면 리포트에 표시됩니다',
    });

    // 3. 커리큘럼 (AI용)
    items.push({
      key: 'curriculum',
      label: '커리큘럼',
      status: academy.curriculum ? 'complete' : 'warning',
      message: academy.curriculum ? undefined : 'AI가 학원 특성을 반영한 코멘트를 생성합니다',
    });

    // 4. 톤 설정
    items.push({
      key: 'tone',
      label: '말투 설정',
      status: 'complete', // 기본값 있으므로 항상 완료
    });

    // 5. 리포트 템플릿
    items.push({
      key: 'templates',
      label: '리포트 템플릿',
      status: 'complete', // 기본값 있으므로 항상 완료
    });

    // 6. 선생님 등록
    items.push({
      key: 'teachers',
      label: `선생님 (${stats.teacherCount}명)`,
      status: stats.teacherCount > 0 ? 'complete' : 'warning',
      message: stats.teacherCount > 0 ? undefined : '선생님을 등록해주세요',
    });

    // 7. 학생 등록
    items.push({
      key: 'students',
      label: `학생 (${stats.studentCount}명)`,
      status: stats.studentCount > 0 ? 'complete' : 'warning',
      message: stats.studentCount > 0 ? undefined : '학생을 등록해주세요',
    });

    // 8. 피드 항목
    items.push({
      key: 'feed_sets',
      label: `피드 항목 (${stats.feedSetCount}개)`,
      status: stats.feedSetCount > 0 ? 'complete' : 'error',
      message: stats.feedSetCount > 0 ? undefined : '피드 항목을 설정해주세요',
    });

    // 9. stats_category 매핑
    if (stats.unmappedCategoryCount > 0) {
      items.push({
        key: 'stats_mapping',
        label: '통계 카테고리',
        status: 'warning',
        message: `${stats.unmappedCategoryCount}개 항목의 카테고리가 미지정입니다`,
      });
    }

    const hasError = items.some(item => item.status === 'error');
    const overallStatus = hasError ? 'incomplete' : 'complete';

    return {
      ok: true,
      data: { items, overallStatus },
    };
  } catch (error) {
    console.error('getSetupHealth error:', error);
    return { ok: false, message: 'Setup Health를 확인하는데 실패했습니다' };
  }
}

// ============================================================================
// 3. 학원 정보 수정
// ============================================================================
export async function updateAcademyInfo(
  input: UpdateAcademyInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    const { error } = await supabase
      .from('tenants')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.tenant_id);

    if (error) {
      console.error('updateAcademyInfo error:', error);
      return { ok: false, message: '학원 정보 저장에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('updateAcademyInfo exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

// ============================================================================
// 4. 리포트 설정 수정
// ============================================================================
export async function updateReportSettings(
  input: UpdateReportSettingsInput
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // upsert로 없으면 생성, 있으면 업데이트
    const { error } = await supabase
      .from('report_settings')
      .upsert(
        {
          tenant_id: profile.tenant_id,
          ...input,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

    if (error) {
      console.error('updateReportSettings error:', error);
      return { ok: false, message: '리포트 설정 저장에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('updateReportSettings exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

// ============================================================================
// 5. 운영 설정 (Basic Settings)
// ============================================================================

export interface BasicSettings {
  progress_enabled: boolean;
  exam_score_enabled: boolean;
}

export interface MakeupDefaults {
  [key: string]: boolean;
}

export interface OperationSettingsData {
  basic: BasicSettings;
  operationMode: OperationMode;  // 🆕 추가
  makeupDefaults: MakeupDefaults;
  hasMakeupSystem: boolean;
  hasMaterialsAddon: boolean;
}

/**
 * 운영 설정 조회
 */
export async function getOperationSettings(): Promise<ActionResult<OperationSettingsData>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // 테넌트 정보 조회 (operation_mode 포함!)
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('settings, plan, operation_mode')  // 🆕 operation_mode 추가
      .eq('id', profile.tenant_id)
      .single();

    if (error) {
      console.error('getOperationSettings error:', error);
      return { ok: false, message: '설정을 불러오는데 실패했습니다' };
    }

    // 피처 플래그 조회 (애드온 확인용)
    const { data: features } = await supabase
      .from('tenant_features')
      .select('feature_key')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_enabled', true);

    const featureKeys = features?.map(f => f.feature_key) || [];

    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const hasMakeupSystem = tenant?.plan === 'premium';
    const hasMaterialsAddon = featureKeys.includes('materials_addon');

    return {
      ok: true,
      data: {
        basic: {
          progress_enabled: (settings.progress_enabled as boolean) ?? false,
          exam_score_enabled: (settings.exam_score_enabled as boolean) ?? false,
        },
        operationMode: (tenant?.operation_mode as OperationMode) || 'solo',  // 🆕 추가
        makeupDefaults: (settings.makeup_defaults as MakeupDefaults) ?? {
          '병결': true,
          '학교행사': true,
          '가사': false,
          '무단': false,
          '기타': true,
        },
        hasMakeupSystem,
        hasMaterialsAddon,
      },
    };
  } catch (error) {
    console.error('getOperationSettings exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 기본 설정 업데이트 (진도/시험 ON/OFF)
 */
export async function updateBasicSettings(
  settings: BasicSettings
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // 기존 settings 가져오기
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', profile.tenant_id)
      .single();

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

    // 병합하여 업데이트
    const { error } = await supabase
      .from('tenants')
      .update({
        settings: {
          ...currentSettings,
          ...settings,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.tenant_id);

    if (error) {
      console.error('updateBasicSettings error:', error);
      return { ok: false, message: '설정 저장에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('updateBasicSettings exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 🆕 운영 모드 업데이트
 */
export async function updateOperationMode(
  mode: OperationMode
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    const { error } = await supabase
      .from('tenants')
      .update({
        operation_mode: mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.tenant_id);

    if (error) {
      console.error('updateOperationMode error:', error);
      return { ok: false, message: '운영 모드 저장에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    revalidatePath('/dashboard/admin/feed-input');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('updateOperationMode exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 보강 설정 업데이트
 */
export async function updateMakeupDefaults(
  makeupDefaults: MakeupDefaults
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // 기존 settings 가져오기
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', profile.tenant_id)
      .single();

    const currentSettings = (tenant?.settings as Record<string, unknown>) || {};

    // makeup_defaults 업데이트
    const { error } = await supabase
      .from('tenants')
      .update({
        settings: {
          ...currentSettings,
          makeup_defaults: makeupDefaults,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.tenant_id);

    if (error) {
      console.error('updateMakeupDefaults error:', error);
      return { ok: false, message: '보강 설정 저장에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('updateMakeupDefaults exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

// ============================================================================
// 6. 교재 관리 (Materials)
// ============================================================================

export interface Material {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * 교재 목록 조회
 */
export async function getMaterials(): Promise<ActionResult<Material[]>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getMaterials error:', error);
      return { ok: false, message: '교재 목록을 불러오는데 실패했습니다' };
    }

    return { ok: true, data: data as Material[] };
  } catch (error) {
    console.error('getMaterials exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 교재 추가
 */
export async function createMaterial(
  name: string,
  category?: string
): Promise<ActionResult<Material>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // 이름 중복 체크
    const { data: existing } = await supabase
      .from('materials')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('name', name.trim())
      .is('deleted_at', null)
      .single();

    if (existing) {
      return { ok: false, message: '이미 등록된 교재명입니다' };
    }

    // 마지막 sort_order 가져오기
    const { data: lastItem } = await supabase
      .from('materials')
      .select('sort_order')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (lastItem?.sort_order ?? -1) + 1;

    const { data, error } = await supabase
      .from('materials')
      .insert({
        tenant_id: profile.tenant_id,
        name: name.trim(),
        category: category?.trim() || null,
        sort_order: nextOrder,
      })
      .select('*')
      .single();

    if (error) {
      console.error('createMaterial error:', error);
      return { ok: false, message: '교재 추가에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    return { ok: true, data: data as Material };
  } catch (error) {
    console.error('createMaterial exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 교재 삭제 (soft delete)
 */
export async function deleteMaterial(
  materialId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    const { error } = await supabase
      .from('materials')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', materialId)
      .eq('tenant_id', profile.tenant_id);

    if (error) {
      console.error('deleteMaterial error:', error);
      return { ok: false, message: '교재 삭제에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('deleteMaterial exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

// ============================================================================
// 7. 시험 종류 관리 (Exam Types)
// ============================================================================

export interface ExamType {
  id: string;
  tenant_id: string;
  name: string;
  set_key: string;
  type: 'exam_score';
  is_active: boolean;
  is_scored: boolean;
  is_required: boolean;
  stats_category: string;
  created_at: string;
}

/**
 * 시험 종류 목록 조회
 */
export async function getExamTypes(): Promise<ActionResult<ExamType[]>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    const { data, error } = await supabase
      .from('feed_option_sets')
      .select('id, tenant_id, name, set_key, type, is_active, is_scored, is_required, stats_category, created_at')
      .eq('tenant_id', profile.tenant_id)
      .eq('type', 'exam_score')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('getExamTypes error:', error);
      return { ok: false, message: '시험 종류를 불러오는데 실패했습니다' };
    }

    return { ok: true, data: (data || []) as ExamType[] };
  } catch (error) {
    console.error('getExamTypes exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 시험 종류 추가
 */
export async function createExamType(
  name: string
): Promise<ActionResult<ExamType>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    // 이름 중복 체크
    const { data: existing } = await supabase
      .from('feed_option_sets')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('name', name.trim())
      .eq('type', 'exam_score')
      .is('deleted_at', null)
      .single();

    if (existing) {
      return { ok: false, message: '이미 등록된 시험명입니다' };
    }

    // set_key 생성 (고유값)
    const setKey = `exam_${Date.now()}`;

    const { data, error } = await supabase
      .from('feed_option_sets')
      .insert({
        tenant_id: profile.tenant_id,
        name: name.trim(),
        set_key: setKey,
        category: 'exam',           // 카테고리
        type: 'exam_score',         // 타입
        is_active: true,
        is_scored: true,            // 점수 입력 가능
        is_required: false,         // 필수 아님 (시험은 미응시 가능)
        is_in_weekly_stats: true,   // 주간 통계 포함
        stats_category: 'EVALUATION', // 통계 카테고리
      })
      .select('id, tenant_id, name, set_key, type, is_active, is_scored, is_required, stats_category, created_at')
      .single();

    if (error) {
      console.error('createExamType error:', error);
      return { ok: false, message: '시험 종류 추가에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    revalidatePath('/dashboard/admin/feed-input');
    return { ok: true, data: data as ExamType };
  } catch (error) {
    console.error('createExamType exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

/**
 * 시험 종류 삭제 (soft delete)
 */
export async function deleteExamType(
  examTypeId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;

    const { error } = await supabase
      .from('feed_option_sets')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', examTypeId)
      .eq('tenant_id', profile.tenant_id)
      .eq('type', 'exam_score');

    if (error) {
      console.error('deleteExamType error:', error);
      return { ok: false, message: '시험 종류 삭제에 실패했습니다' };
    }

    revalidatePath('/dashboard/admin/settings');
    revalidatePath('/dashboard/admin/feed-input');
    return { ok: true, data: { success: true } };
  } catch (error) {
    console.error('deleteExamType exception:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}
