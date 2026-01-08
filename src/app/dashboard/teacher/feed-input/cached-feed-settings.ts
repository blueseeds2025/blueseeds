import { SupabaseClient } from '@supabase/supabase-js';
import { 
  FeedOptionSet,
  FeedOption,
  ExamType,
  TenantSettings,
  Textbook,
  ClassInfo,
} from './types';

// ============================================================================
// 피드 설정 데이터 타입
// ============================================================================

export interface FeedSettingsData {
  classes: ClassInfo[];
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];
  tenantSettings: TenantSettings;
}

// ============================================================================
// 피드 설정 조회
// ============================================================================

export async function fetchFeedSettings(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  role: 'owner' | 'teacher'
): Promise<FeedSettingsData> {
  // 병렬 조회
  const [
    classesResult,
    optionSetsResult,
    examTypesResult,
    textbooksResult,
    tenantSettingsResult,
    featuresResult,
    // ✅ teacher인 경우 피드 권한 조회
    feedPermissionsResult,
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
    
    // ✅ 7. 선생님 피드 권한 (teacher인 경우만 사용)
    role === 'teacher'
      ? supabase
          .from('teacher_feed_permissions')
          .select('option_set_id, is_allowed')
          .eq('tenant_id', tenantId)
          .eq('teacher_id', userId)
      : Promise.resolve({ data: null }),
  ]);
  
  // 반 목록 처리
  const classes: ClassInfo[] = (classesResult.data || []).map(c => ({
    id: c.id,
    name: c.name,
    color: c.color ?? undefined,
  }));
  
  // ✅ teacher 권한 맵 생성
  let allowedSetIds: Set<string> | null = null;
  
  if (role === 'teacher' && feedPermissionsResult.data) {
    // 권한 설정이 있는 경우: is_allowed=true인 것만 허용
    const permissions = feedPermissionsResult.data as { option_set_id: string; is_allowed: boolean }[];
    
    if (permissions.length > 0) {
      allowedSetIds = new Set(
        permissions
          .filter(p => p.is_allowed === true)
          .map(p => p.option_set_id)
      );
    }
    // permissions.length === 0이면 권한 설정 없음 → 전체 허용 (allowedSetIds = null)
  }
  
  // 옵션 세트 처리 (✅ teacher 권한 필터링 적용)
  let filteredOptionSets = optionSetsResult.data || [];
  
  if (allowedSetIds !== null) {
    // 권한 설정이 있는 경우: 허용된 것만 필터링
    filteredOptionSets = filteredOptionSets.filter(set => allowedSetIds!.has(set.id));
  }
  
  const setIds = filteredOptionSets.map(s => s.id);
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
  
  const optionSets: FeedOptionSet[] = filteredOptionSets.map(set => ({
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
