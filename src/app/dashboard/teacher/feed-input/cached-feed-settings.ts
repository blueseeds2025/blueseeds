import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { 
  FeedOptionSet,
  FeedOption,
  ExamType,
  TenantSettings,
  Textbook,
  ClassInfo,
} from './types';
import { CacheTags } from './cache-utils';

// ============================================================================
// 캐시된 피드 설정 조회 (정적 데이터)
// - optionSets, examTypes, textbooks, tenantSettings, classes
// - 거의 안 바뀌므로 캐시 적용
// ============================================================================

interface FeedSettingsData {
  classes: ClassInfo[];
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];
  tenantSettings: TenantSettings;
}

async function fetchFeedSettingsInternal(
  tenantId: string,
  userId: string,
  role: 'owner' | 'teacher'
): Promise<FeedSettingsData> {
  const supabase = await createClient();
  
  // 병렬 조회
  const [
    classesResult,
    optionSetsResult,
    examTypesResult,
    textbooksResult,
    tenantSettingsResult,
    featuresResult,
  ] = await Promise.all([
    // 1. 반 목록
    (async () => {
      let query = supabase
        .from('classes')
        .select('id, name, color')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name');
      
      if (role === 'teacher') {
        const { data: assignments } = await supabase
          .from('class_teachers')
          .select('class_id')
          .eq('tenant_id', tenantId)
          .eq('teacher_id', userId)
          .eq('is_active', true)
          .is('deleted_at', null);
        
        const classIds = (assignments || [])
          .map(a => a.class_id)
          .filter((id): id is string => id !== null);
        
        if (classIds.length === 0) {
          return { data: [] };
        }
        
        query = query.in('id', classIds);
      }
      
      return query;
    })(),
    
    // 2. 피드 옵션 세트 (normal 타입만)
    supabase
      .from('feed_option_sets')
      .select('id, name, set_key, is_scored, is_required, type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .or('type.is.null,type.eq.normal')
      .order('created_at'),
    
    // 3. 시험 타입 (exam_score 타입만)
    supabase
      .from('feed_option_sets')
      .select('id, name, set_key, is_scored, max_score')
      .eq('tenant_id', tenantId)
      .eq('type', 'exam_score')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at'),
    
    // 4. 교재 목록
    supabase
      .from('textbooks')
      .select('id, title, total_pages, display_order')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order'),
    
    // 5. 테넌트 설정
    supabase
      .from('tenant_settings')
      .select('setting_key, setting_value')
      .eq('tenant_id', tenantId),
    
    // 6. 테넌트 기능
    supabase
      .from('tenant_features')
      .select('feature_key')
      .eq('tenant_id', tenantId)
      .eq('is_enabled', true)
      .is('deleted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()'),
  ]);
  
  // 반 목록 처리
  const classes: ClassInfo[] = (classesResult.data || []).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color ?? undefined,
  }));
  
  // 옵션 세트 처리
  const setIds = (optionSetsResult.data || []).map(s => s.id);
  let allOptions: FeedOption[] = [];
  
  if (setIds.length > 0) {
    const { data: optionsData } = await supabase
      .from('feed_options')
      .select('id, set_id, label, score, display_order')
      .in('set_id', setIds)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order');
    
    allOptions = (optionsData || []).map(opt => ({
      id: opt.id,
      set_id: opt.set_id!,
      label: opt.label,
      score: opt.score,
      display_order: opt.display_order ?? 0,
    }));
  }
  
  const optionsBySetId: Record<string, FeedOption[]> = {};
  for (const opt of allOptions) {
    if (!optionsBySetId[opt.set_id]) {
      optionsBySetId[opt.set_id] = [];
    }
    optionsBySetId[opt.set_id].push(opt);
  }
  
  const optionSets: FeedOptionSet[] = (optionSetsResult.data || []).map(set => ({
    id: set.id,
    name: set.name,
    set_key: set.set_key,
    is_scored: set.is_scored ?? false,
    is_required: set.is_required ?? false,
    options: optionsBySetId[set.id] || [],
  }));
  
  // 시험 타입 처리
  const examTypes: ExamType[] = (examTypesResult.data || []).map(exam => ({
    id: exam.id,
    name: exam.name,
    set_key: exam.set_key ?? undefined,
    maxScore: exam.max_score ?? 100,
  }));
  
  // 교재 처리
  const textbooks: Textbook[] = (textbooksResult.data || []).map(tb => ({
    id: tb.id,
    title: tb.title,
    totalPages: tb.total_pages,
    displayOrder: tb.display_order ?? 0,
  }));
  
  // 설정 처리
  const settingsMap: Record<string, string | boolean> = {};
  for (const row of tenantSettingsResult.data || []) {
    if (row.setting_key && row.setting_value !== null) {
      const value = row.setting_value;
      if (value === 'true') {
        settingsMap[row.setting_key] = true;
      } else if (value === 'false') {
        settingsMap[row.setting_key] = false;
      } else {
        settingsMap[row.setting_key] = value;
      }
    }
  }
  
  const features = (featuresResult.data || [])
    .map(f => f.feature_key)
    .filter((key): key is string => key !== null);
  
  const tenantSettings: TenantSettings = {
    progress_enabled: settingsMap['progress_enabled'] === true,
    materials_enabled: settingsMap['materials_enabled'] === true,
    exam_score_enabled: settingsMap['exam_score_enabled'] === true,
    makeup_defaults: {
      '병결': true,
      '학교행사': true,
      '가사': false,
      '무단': false,
      '기타': true,
    },
    plan: (settingsMap['plan'] as 'basic' | 'standard' | 'premium') || 'basic',
    features,
    operation_mode: (settingsMap['operation_mode'] as 'solo' | 'team') || 'solo',
  };
  
  return {
    classes,
    optionSets,
    examTypes,
    textbooks,
    tenantSettings,
  };
}

// ============================================================================
// 캐시된 함수 (tenant별 1시간 캐시)
// ============================================================================

export function getCachedFeedSettings(
  tenantId: string,
  userId: string,
  role: 'owner' | 'teacher'
) {
  return unstable_cache(
    () => fetchFeedSettingsInternal(tenantId, userId, role),
    [`feed-settings`, tenantId, userId, role],
    {
      tags: [CacheTags.feedSettings(tenantId)],
      revalidate: 3600, // 1시간
    }
  )();
}
