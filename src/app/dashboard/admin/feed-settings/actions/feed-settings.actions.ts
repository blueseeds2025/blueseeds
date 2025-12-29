'use server';

import { supabaseServer, getTenantIdOrThrow } from '@/lib/supabase/actions';
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
    const { data: newSet, error: setError } = await sb
      .from('feed_option_sets')
      .insert({
        config_id: configId,
        tenant_id: tenantId,
        name: newName,
        set_key: `${sourceSet.set_key}_copy_${timestamp}`,
        category: newName,
        is_scored: sourceSet.is_scored,
        score_step: sourceSet.score_step,
        is_active: true,
        default_report_category: sourceSet.default_report_category ?? 'study',
      })
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
      const inserts = sourceOptions.map((o: any, idx: number) => ({
        set_id: newSet.id,
        label: o.label,
        score: o.score,
        display_order: idx,
        is_active: true,
        report_category: o.report_category ?? (sourceSet.default_report_category ?? 'study'),
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

    const { data, error } = await sb
      .from('feed_option_sets')
      .insert({
        config_id: params.configId,
        tenant_id: tenantId,
        name: params.name,
        set_key: params.setKey,
        category: params.name,
        is_scored: params.isScored,
        score_step: params.scoreStep,
        is_active: true,
        default_report_category: params.category,
      })
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
    await getTenantIdOrThrow(sb); // 권한 검증

    const insertData: Record<string, unknown> = {
      set_id: params.setId,
      label: params.label,
      display_order: params.displayOrder,
      is_active: true,
      report_category: params.category,
    };

    if (params.score !== null) {
      insertData.score = params.score;
    }

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
 * Option 순서 일괄 변경
 */
export async function updateOptionOrder(
  updates: { id: string; displayOrder: number }[]
): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    await getTenantIdOrThrow(sb); // 권한 검증

    // 병렬 처리
    const results = await Promise.all(
      updates.map(({ id, displayOrder }) =>
        sb.from('feed_options')
          .update({ display_order: displayOrder })
          .eq('id', id)
      )
    );

    const firstError = results.find(r => r.error)?.error;
    if (firstError) throw firstError;

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

    // RPC 호출 (트랜잭션 처리)
    const { data, error } = await sb.rpc('apply_feed_template', {
      p_config_id: configId,
      p_tenant_id: tenantId,
      p_template_data: templateData,
    });

    if (error) {
      console.error('applyTemplate RPC error:', error);
      throw error;
    }

    if (!data?.success) {
      return { ok: false, message: '템플릿 적용에 실패했습니다' };
    }

    // RPC 결과 파싱
    const sets: OptionSet[] = data.sets || [];
    const options: Record<string, Option[]> = data.options || {};

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
      const { data: newSet, error: setError } = await sb
        .from('feed_option_sets')
        .insert({
          config_id: configId,
          tenant_id: tenantId,
          name: setData.name,
          set_key: `${setData.set_key}_${timestamp}`,
          category: setData.name,
          is_scored: setData.is_scored,
          score_step: setData.score_step ?? null,
          default_report_category: setData.report_category ?? 'study',
          is_active: true,
        })
        .select('*')
        .single();

      if (setError || !newSet) throw setError;

      const createdOptions: Option[] = [];

      for (let i = 0; i < setData.options.length; i++) {
        const { data: newOpt, error: optError } = await sb
          .from('feed_options')
          .insert({
            set_id: newSet.id,
            label: setData.options[i].label,
            score: setData.options[i].score,
            display_order: i,
            is_active: true,
            report_category: setData.report_category ?? 'study',
          })
          .select('*')
          .single();

        if (optError) throw optError;
        if (newOpt) {
          createdOptions.push(newOpt as Option);
        }
      }

      newSets.push(newSet as OptionSet);
      newOptions[newSet.id] = createdOptions;
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