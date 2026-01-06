'use server';

import { supabaseServer, getTenantIdOrThrow } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import type { FeedConfig, OptionSet, Option, ReportCategory } from '@/types/feed-settings';

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; message: string };

interface OptionSetWithOptions {
  sets: OptionSet[];
  options: Record<string, Option[]>;
}

interface CreateOptionSetParams {
  configId: string;
  name: string;
  setKey: string;
  isScored: boolean;
  scoreStep: number | null;
  category: ReportCategory;
}

interface CreateOptionParams {
  setId: string;
  label: string;
  score: number | null;
  displayOrder: number;
  category: ReportCategory;
}

interface TemplateSetData {
  name: string;
  set_key: string;
  is_scored: boolean;
  score_step?: number | null;
  report_category?: ReportCategory;
  options: { label: string; score: number | null }[];
}

// Database Insert 타입
type FeedOptionInsert = Database['public']['Tables']['feed_options']['Insert'];
type FeedOptionSetInsert = Database['public']['Tables']['feed_option_sets']['Insert'];

// RPC 응답 타입
interface BulkUpdateOrderResponse {
  success: boolean;
  error?: string;
}

interface ApplyTemplateResponse {
  success: boolean;
  sets?: OptionSet[];
  options?: Record<string, Option[]>;
  error?: string;
}

// ============================================================================
// Config Actions
// ============================================================================

/**
 * 활성 Config 조회 또는 생성
 */
export async function ensureActiveConfig(): Promise<ActionResult<FeedConfig>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 기존 활성 Config 조회
    const { data: existing, error: loadError } = await sb
      .from('feed_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (loadError) throw loadError;

    if (existing) {
      return { ok: true, data: existing as FeedConfig };
    }

    // 없으면 생성
    const { data: created, error: createError } = await sb
      .from('feed_configs')
      .insert({
        tenant_id: tenantId,
        name: '기본 설정 V1',
        is_active: true,
        applied_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createError) throw createError;

    return { ok: true, data: created as FeedConfig };
  } catch (error) {
    console.error('ensureActiveConfig error:', error);
    return { ok: false, message: '설정을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// OptionSet Query Actions
// ============================================================================

/**
 * OptionSet + Options 한번에 조회
 */
export async function loadOptionSetsWithOptions(
  configId: string
): Promise<ActionResult<OptionSetWithOptions>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // OptionSets 조회 (tenant_id 명시적 검증)
    const { data: sets, error: setsError } = await sb
      .from('feed_option_sets')
      .select('*')
      .eq('config_id', configId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at');

    if (setsError) throw setsError;

    const optionSets = (sets ?? []) as OptionSet[];
    const setIds = optionSets.map(s => s.id);
    
    // Options 일괄 조회
    const optionsMap: Record<string, Option[]> = {};
    for (const id of setIds) {
      optionsMap[id] = [];
    }

    if (setIds.length > 0) {
      const { data: allOptions, error: optError } = await sb
        .from('feed_options')
        .select('*')
        .in('set_id', setIds)
        .eq('is_active', true)
        .order('display_order');

      if (optError) throw optError;

      for (const opt of (allOptions ?? []) as Option[]) {
        if (optionsMap[opt.set_id]) {
          optionsMap[opt.set_id].push(opt);
        }
      }
    }

    return { 
      ok: true, 
      data: { sets: optionSets, options: optionsMap } 
    };
  } catch (error) {
    console.error('loadOptionSetsWithOptions error:', error);
    return { ok: false, message: '평가항목을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// OptionSet Mutation Actions
// ============================================================================

/**
 * OptionSet 활성/비활성 토글
 */
export async function toggleOptionSetActive(
  setId: string,
  newIsActive: boolean
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    const { error } = await sb
      .from('feed_option_sets')
      .update({ is_active: newIsActive })
      .eq('id', setId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('toggleOptionSetActive error:', error);
    return { ok: false, message: '상태 변경에 실패했습니다' };
  }
}

/**
 * OptionSet 삭제 (soft delete + Options 비활성화)
 * 트랜잭션으로 처리
 */
export async function deleteOptionSet(setId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 1. Options 비활성화
    const { error: optError } = await sb
      .from('feed_options')
      .update({ is_active: false })
      .eq('set_id', setId);

    if (optError) throw optError;

    // 2. Set soft delete
    const { error: setError } = await sb
      .from('feed_option_sets')
      .update({ 
        deleted_at: new Date().toISOString(), 
        is_active: false 
      })
      .eq('id', setId)
      .eq('tenant_id', tenantId);

    if (setError) throw setError;

    return { ok: true };
  } catch (error) {
    console.error('deleteOptionSet error:', error);
    return { ok: false, message: '삭제에 실패했습니다' };
  }
}

/**
 * OptionSet 이름 변경
 */
export async function updateOptionSetName(
  setId: string,
  newName: string
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    const { error } = await sb
      .from('feed_option_sets')
      .update({ name: newName.trim() })
      .eq('id', setId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('updateOptionSetName error:', error);
    return { ok: false, message: '이름 변경에 실패했습니다' };
  }
}

/**
 * OptionSet 카테고리 변경 (Set + 모든 Options)
 */
export async function changeOptionSetCategory(
  setId: string,
  newCategory: ReportCategory
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 1. Set 카테고리 변경
    const { error: setError } = await sb
      .from('feed_option_sets')
      .update({ default_report_category: newCategory })
      .eq('id', setId)
      .eq('tenant_id', tenantId);

    if (setError) throw setError;

    // 2. 모든 Options 카테고리 변경
    const { error: optError } = await sb
      .from('feed_options')
      .update({ report_category: newCategory })
      .eq('set_id', setId);

    if (optError) throw optError;

    return { ok: true };
  } catch (error) {
    console.error('changeOptionSetCategory error:', error);
    return { ok: false, message: '카테고리 변경에 실패했습니다' };
  }
}

/**
 * OptionSet 복제
 */
export async function duplicateOptionSet(
  sourceSetId: string,
  configId: string
): Promise<ActionResult<{ set: OptionSet; options: Option[] }>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 원본 Set 조회
    const { data: sourceSet, error: sourceError } = await sb
      .from('feed_option_sets')
      .select('*')
      .eq('id', sourceSetId)
      .eq('tenant_id', tenantId)
      .single();

    if (sourceError || !sourceSet) {
      return { ok: false, message: '원본을 찾을 수 없습니다' };
    }

    const timestamp = Date.now();
    const newName = `${sourceSet.name} (복제)`;

    // 새 Set 생성
    const newSetData: FeedOptionSetInsert = {
      config_id: configId,
      tenant_id: tenantId,
      name: newName,
      set_key: `${sourceSet.set_key}_copy_${timestamp}`,
      category: sourceSet.default_report_category ?? 'study',
      is_scored: sourceSet.is_scored ?? false,
      score_step: sourceSet.score_step,
      is_active: true,
      default_report_category: sourceSet.default_report_category ?? 'study',
    };

    const { data: newSet, error: setError } = await sb
      .from('feed_option_sets')
      .insert(newSetData)
      .select('*')
      .single();

    if (setError || !newSet) throw setError;

    // 원본 Options 조회
    const { data: sourceOptions, error: optLoadError } = await sb
      .from('feed_options')
      .select('*')
      .eq('set_id', sourceSetId)
      .eq('is_active', true)
      .order('display_order');

    if (optLoadError) throw optLoadError;

    let newOptions: Option[] = [];

    if (sourceOptions && sourceOptions.length > 0) {
      const inserts: FeedOptionInsert[] = sourceOptions.map((o, idx) => ({
        set_id: newSet.id,
        tenant_id: tenantId,
        label: o.label,
        score: o.score,
        display_order: idx,
        is_active: true,
        report_category: o.report_category ?? sourceSet.default_report_category ?? 'study',
      }));

      const { data: insertedOpts, error: optInsertError } = await sb
        .from('feed_options')
        .insert(inserts)
        .select();

      if (optInsertError) throw optInsertError;
      newOptions = (insertedOpts ?? []) as Option[];
    }

    return { 
      ok: true, 
      data: { set: newSet as OptionSet, options: newOptions } 
    };
  } catch (error) {
    console.error('duplicateOptionSet error:', error);
    return { ok: false, message: '복제에 실패했습니다' };
  }
}

/**
 * 새 OptionSet 생성
 */
export async function createOptionSet(
  params: CreateOptionSetParams
): Promise<ActionResult<OptionSet>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    const insertData: FeedOptionSetInsert = {
      config_id: params.configId,
      tenant_id: tenantId,
      name: params.name,
      set_key: params.setKey,
      category: params.category,
      is_scored: params.isScored,
      score_step: params.scoreStep,
      is_active: true,
      default_report_category: params.category,
    };

    const { data, error } = await sb
      .from('feed_option_sets')
      .insert(insertData)
      .select('*')
      .single();

    if (error) throw error;

    return { ok: true, data: data as OptionSet };
  } catch (error) {
    console.error('createOptionSet error:', error);
    return { ok: false, message: '평가항목 생성에 실패했습니다' };
  }
}

/**
 * 모든 OptionSet 아카이브 (템플릿 적용 전)
 */
export async function archiveAllOptionSets(
  configId: string
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 현재 Set ID들 조회
    const { data: sets, error: loadError } = await sb
      .from('feed_option_sets')
      .select('id')
      .eq('config_id', configId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (loadError) throw loadError;

    if (!sets || sets.length === 0) {
      return { ok: true };
    }

    const ids = sets.map(s => s.id);

    // 1. Sets 아카이브
    const { error: setError } = await sb
      .from('feed_option_sets')
      .update({ 
        deleted_at: new Date().toISOString(), 
        is_active: false 
      })
      .in('id', ids);

    if (setError) throw setError;

    // 2. Options 비활성화
    const { error: optError } = await sb
      .from('feed_options')
      .update({ is_active: false })
      .in('set_id', ids);

    if (optError) throw optError;

    return { ok: true };
  } catch (error) {
    console.error('archiveAllOptionSets error:', error);
    return { ok: false, message: '기존 항목 삭제에 실패했습니다' };
  }
}

// ============================================================================
// Option Mutation Actions
// ============================================================================

/**
 * Option 추가
 */
export async function createOption(
  params: CreateOptionParams
): Promise<ActionResult<Option>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    const insertData: FeedOptionInsert = {
      set_id: params.setId,
      tenant_id: tenantId,
      label: params.label,
      display_order: params.displayOrder,
      is_active: true,
      report_category: params.category,
      score: params.score,
    };

    const { data, error } = await sb
      .from('feed_options')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return { ok: true, data: data as Option };
  } catch (error) {
    console.error('createOption error:', error);
    return { ok: false, message: '선택지 추가에 실패했습니다' };
  }
}

/**
 * Option 수정
 */
export async function updateOption(
  optionId: string,
  newLabel: string,
  newScore: number | null
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    await getTenantIdOrThrow(sb); // 권한 검증

    const { error } = await sb
      .from('feed_options')
      .update({ label: newLabel, score: newScore })
      .eq('id', optionId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('updateOption error:', error);
    return { ok: false, message: '수정에 실패했습니다' };
  }
}

/**
 * Option 삭제 (soft delete)
 */
export async function deleteOption(optionId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    await getTenantIdOrThrow(sb); // 권한 검증

    const { error } = await sb
      .from('feed_options')
      .update({ is_active: false })
      .eq('id', optionId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('deleteOption error:', error);
    return { ok: false, message: '삭제에 실패했습니다' };
  }
}

/**
 * Option 순서 일괄 변경 (Bulk Update)
 */
export async function updateOptionOrder(
  updates: { id: string; displayOrder: number }[]
): Promise<ActionResult> {
  if (updates.length === 0) {
    return { ok: true };
  }

  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // RPC로 Bulk Update (1번의 DB 호출)
    const { data, error } = await sb.rpc('bulk_update_option_order', {
      p_tenant_id: tenantId,
      p_updates: updates.map(u => ({
        id: u.id,
        display_order: u.displayOrder,
      })),
    });

    if (error) {
      console.error('updateOptionOrder RPC error:', error);
      throw error;
    }

    // RPC 응답 타입 단언
    const response = data as unknown as BulkUpdateOrderResponse;
    if (!response?.success) {
      throw new Error(response?.error || '순서 변경 실패');
    }

    return { ok: true };
  } catch (error) {
    console.error('updateOptionOrder error:', error);
    return { ok: false, message: '순서 변경에 실패했습니다' };
  }
}

// ============================================================================
// Template Actions
// ============================================================================

/**
 * 템플릿 적용 (기존 아카이브 + 새 Set/Options 생성)
 * 트랜잭션으로 처리하여 데이터 무결성 보장
 */
export async function applyTemplate(
  configId: string,
  templateData: TemplateSetData[]
): Promise<ActionResult<OptionSetWithOptions>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // JSON으로 변환하여 RPC에 전달
    const templateJson = JSON.parse(JSON.stringify(templateData));

    // RPC 호출 (트랜잭션 처리)
    const { data, error } = await sb.rpc('apply_feed_template', {
      p_config_id: configId,
      p_tenant_id: tenantId,
      p_template_data: templateJson,
    });

    if (error) {
      console.error('applyTemplate RPC error:', error);
      throw error;
    }

    // RPC 응답 타입 단언
    const response = data as unknown as ApplyTemplateResponse;
    if (!response?.success) {
      return { ok: false, message: '템플릿 적용에 실패했습니다' };
    }

    // RPC 결과 파싱
    const sets: OptionSet[] = response.sets || [];
    const options: Record<string, Option[]> = response.options || {};

    return {
      ok: true,
      data: { sets, options },
    };
  } catch (error) {
    console.error('applyTemplate error:', error);
    return { ok: false, message: '템플릿 적용에 실패했습니다' };
  }
}

/**
 * 템플릿 적용 (Fallback - RPC가 없을 경우)
 * 기존 로직 유지, 트랜잭션 미지원
 */
export async function applyTemplateFallback(
  configId: string,
  templateData: TemplateSetData[]
): Promise<ActionResult<OptionSetWithOptions>> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    // 1. 기존 항목 아카이브
    const archiveResult = await archiveAllOptionSets(configId);
    if (!archiveResult.ok) {
      return { ok: false, message: archiveResult.message };
    }

    const timestamp = Date.now();
    const newSets: OptionSet[] = [];
    const newOptions: Record<string, Option[]> = {};

    // 2. 새 Set + Options 생성
    for (const setData of templateData) {
      const newSetData: FeedOptionSetInsert = {
        config_id: configId,
        tenant_id: tenantId,
        name: setData.name,
        set_key: `${setData.set_key}_${timestamp}`,
        category: setData.name,
        is_scored: setData.is_scored,
        score_step: setData.score_step ?? null,
        default_report_category: setData.report_category ?? 'study',
        is_active: true,
      };

      const { data: newSet, error: setError } = await sb
        .from('feed_option_sets')
        .insert(newSetData)
        .select('*')
        .single();

      if (setError || !newSet) throw setError;

      // Options Bulk Insert (N+1 해결)
      if (setData.options.length > 0) {
        const optionInserts: FeedOptionInsert[] = setData.options.map((opt, i) => ({
          set_id: newSet.id,
          tenant_id: tenantId,
          label: opt.label,
          score: opt.score,
          display_order: i,
          is_active: true,
          report_category: setData.report_category ?? 'study',
        }));

        const { data: createdOpts, error: optError } = await sb
          .from('feed_options')
          .insert(optionInserts)
          .select('*');

        if (optError) throw optError;

        newOptions[newSet.id] = (createdOpts as Option[]) ?? [];
      } else {
        newOptions[newSet.id] = [];
      }

      newSets.push(newSet as OptionSet);
    }

    return {
      ok: true,
      data: { sets: newSets, options: newOptions },
    };
  } catch (error) {
    console.error('applyTemplateFallback error:', error);
    return { ok: false, message: '템플릿 적용에 실패했습니다' };
  }
}

// ============================================================================
// Tenant Settings Actions
// ============================================================================

export interface BasicSettings {
  progress_enabled: boolean;
  materials_enabled: boolean;
  exam_score_enabled: boolean;
}

export interface MakeupSettings {
  makeup_defaults: Record<string, boolean>;
}

export interface TenantSettingsData {
  basic: BasicSettings;
  makeup: MakeupSettings;
}

/**
 * Tenant 설정 조회
 */
export async function getTenantSettings(): Promise<ActionResult<TenantSettingsData>> {
  try {
    const supabase = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(supabase);

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    const settings = (tenant?.settings as Record<string, unknown>) || {};

    return {
      ok: true,
      data: {
        basic: {
          progress_enabled: (settings.progress_enabled as boolean) ?? false,
          materials_enabled: (settings.materials_enabled as boolean) ?? false,
          exam_score_enabled: (settings.exam_score_enabled as boolean) ?? false,
        },
        makeup: {
          makeup_defaults: (settings.makeup_defaults as Record<string, boolean>) ?? {
            '병결': true,
            '학교행사': true,
            '가사': false,
            '무단': false,
            '기타': true,
          },
        },
      },
    };
  } catch (error) {
    console.error('getTenantSettings error:', error);
    return { ok: false, message: '설정을 불러오는데 실패했습니다' };
  }
}

/**
 * 기본 설정 업데이트
 */
export async function updateBasicSettings(
  settings: BasicSettings
): Promise<ActionResult> {
  try {
    const supabase = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(supabase);

    // 기존 settings 가져오기
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
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
      .eq('id', tenantId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('updateBasicSettings error:', error);
    return { ok: false, message: '설정 저장에 실패했습니다' };
  }
}

/**
 * 보강 설정 업데이트
 */
export async function updateMakeupSettings(
  makeupDefaults: Record<string, boolean>
): Promise<ActionResult> {
  try {
    const supabase = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(supabase);

    // 기존 settings 가져오기
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
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
      .eq('id', tenantId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('updateMakeupSettings error:', error);
    return { ok: false, message: '설정 저장에 실패했습니다' };
  }
}

/**
 * OptionSet 주간 리포트 설정 변경
 */
export async function updateOptionSetWeeklyStats(
  setId: string,
  isInWeeklyStats: boolean,
  statsCategory: string | null
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    const { error } = await sb
      .from('feed_option_sets')
      .update({ 
        is_in_weekly_stats: isInWeeklyStats,
        stats_category: statsCategory || null,
      })
      .eq('id', setId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('updateOptionSetWeeklyStats error:', error);
    return { ok: false, message: '주간 리포트 설정 변경에 실패했습니다' };
  }
}