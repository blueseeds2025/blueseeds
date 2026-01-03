'use server';

import { createClient } from '@/lib/supabase/server';
import { 
  ClassInfo, 
  ClassStudent,
  FeedOptionSet,
  FeedOption,
  ExamType,
  SavedFeedData,
  TenantSettings
} from '../types';

// ============================================================================
// 교사가 담당하는 반 목록 조회
// ============================================================================

export async function getTeacherClasses(): Promise<{
  success: boolean;
  data?: ClassInfo[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    let query = supabase
      .from('classes')
      .select('id, name, color')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
    if (profile.role === 'teacher') {
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      const classIds = (assignments || [])
        .map(a => a.class_id)
        .filter((id): id is string => id !== null);
      
      if (classIds.length === 0) {
        return { success: true, data: [] };
      }
      
      query = query.in('id', classIds);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // color 타입 맞추기: null → undefined
    const result: ClassInfo[] = (data || []).map(c => ({
      id: c.id,
      name: c.name,
      color: c.color ?? undefined,
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getTeacherClasses error:', error);
    return { success: false, error: '반 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 반에 속한 학생 목록 조회 (enrollments 기준)
// ============================================================================

export async function getClassStudents(classId: string): Promise<{
  success: boolean;
  data?: ClassStudent[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // 인증 체크
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 🆕 class_members → enrollments 변경
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        students (
          id,
          name,
          display_code
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', classId)
      .is('end_date', null)  // 현재 활성 소속
      .is('deleted_at', null);
    
    if (error) throw error;
    
    const students: ClassStudent[] = (data || [])
      .filter(item => item.students)
      .map(item => {
        const s = item.students as { id: string; name: string; display_code: string | null };
        return {
          id: s.id,
          name: s.name,
          display_code: s.display_code ?? '',
          class_id: classId,
          is_makeup: false,
        };
      });
    
    return { success: true, data: students };
  } catch (error) {
    console.error('getClassStudents error:', error);
    return { success: false, error: '학생 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 피드 옵션 세트 조회 (교사 권한 필터링 포함) - normal 타입만
// ============================================================================

export async function getFeedOptionSets(): Promise<{
  success: boolean;
  data?: FeedOptionSet[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 🆕 type이 'normal'이거나 null인 것만 (exam_score 제외)
    const { data: sets, error: setsError } = await supabase
      .from('feed_option_sets')
      .select('id, name, set_key, is_scored, is_required, type')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .or('type.is.null,type.eq.normal')
      .order('created_at');
    
    if (setsError) throw setsError;
    
    let filteredSets = sets;
    
    if (profile.role === 'teacher') {
      const { data: featureData } = await supabase
        .from('tenant_features')
        .select('is_enabled')
        .eq('tenant_id', profile.tenant_id)
        .eq('feature_key', 'teacher_permissions')
        .single();
      
      const hasTeacherPermissionsFeature = featureData?.is_enabled ?? false;
      
      if (hasTeacherPermissionsFeature) {
        const { data: permissions } = await supabase
          .from('teacher_feed_permissions')
          .select('option_set_id, is_allowed')
          .eq('teacher_id', user.id)
          .is('deleted_at', null);
        
        if (permissions && permissions.length > 0) {
          const disallowedSetIds = permissions
            .filter(p => p.is_allowed === false)
            .map(p => p.option_set_id);
          
          filteredSets = sets?.filter(s => 
            !disallowedSetIds.includes(s.id)
          );
        }
      }
    }
    
    // 세트가 없으면 빈 배열 반환
    if (!filteredSets || filteredSets.length === 0) {
      return { success: true, data: [] };
    }

    // 옵션 일괄 조회 (N+1 → 1 쿼리로 최적화)
    const setIds = filteredSets.map(s => s.id);
    const { data: allOptions } = await supabase
      .from('feed_options')
      .select('id, set_id, label, score, display_order')
      .in('set_id', setIds)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order');

    // 메모리에서 세트별로 그룹핑
    const optionsBySetId: Record<string, FeedOption[]> = {};
    
    for (const opt of allOptions || []) {
      if (!opt.set_id) continue;
      
      const feedOption: FeedOption = {
        id: opt.id,
        set_id: opt.set_id,
        label: opt.label,
        score: opt.score,
        display_order: opt.display_order ?? 0,
      };
      
      if (!optionsBySetId[opt.set_id]) {
        optionsBySetId[opt.set_id] = [];
      }
      optionsBySetId[opt.set_id].push(feedOption);
    }

    // 결과 조합
    const result: FeedOptionSet[] = filteredSets.map(set => ({
      id: set.id,
      name: set.name,
      set_key: set.set_key,
      is_scored: set.is_scored ?? false,
      is_required: set.is_required ?? false,
      options: optionsBySetId[set.id] || [],
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getFeedOptionSets error:', error);
    return { success: false, error: '피드 항목을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 🆕 시험 종류 조회 (type='exam_score')
// ============================================================================

export async function getExamTypes(): Promise<{
  success: boolean;
  data?: ExamType[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    const { data, error } = await supabase
      .from('feed_option_sets')
      .select('id, name, set_key')
      .eq('tenant_id', profile.tenant_id)
      .eq('type', 'exam_score')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at');
    
    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('getExamTypes error:', error);
    return { success: false, error: '시험 종류를 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 특정 날짜의 저장된 피드 데이터 조회
// ============================================================================

export async function getSavedFeeds(
  classId: string, 
  feedDate: string
): Promise<{
  success: boolean;
  data?: Record<string, SavedFeedData>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    // 인증 체크
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    const { data: feeds, error: feedsError } = await supabase
      .from('student_feeds')
      .select(`
        id,
        student_id,
        attendance_status,
        absence_reason,
        absence_reason_detail,
        notify_parent,
        is_makeup,
        progress_text,
        memo_values
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', classId)
      .eq('feed_date', feedDate);
    
    if (feedsError) throw feedsError;
    
    const feedIds = (feeds || []).map(f => f.id);
    const feedValuesMap: Record<string, { set_id: string | null; option_id: string | null; score: number | null }[]> = {};
    
    if (feedIds.length > 0) {
      const { data: values, error: valuesError } = await supabase
        .from('feed_values')
        .select('feed_id, set_id, option_id, score')
        .in('feed_id', feedIds);
      
      if (valuesError) throw valuesError;
      
      for (const v of values || []) {
        if (!v.feed_id) continue;
        if (!feedValuesMap[v.feed_id]) {
          feedValuesMap[v.feed_id] = [];
        }
        feedValuesMap[v.feed_id].push(v);
      }
    }
    
    // 🆕 시험 타입 세트 ID 목록 조회 (exam_score 구분용)
    const { data: examSets } = await supabase
      .from('feed_option_sets')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('type', 'exam_score')
      .eq('is_active', true);
    
    const examSetIds = new Set((examSets || []).map(s => s.id));
    
    const result: Record<string, SavedFeedData> = {};
    
    for (const feed of feeds || []) {
      if (!feed.student_id) continue;
      
      const values = feedValuesMap[feed.id] || [];
      
      // 🆕 일반 피드값과 시험 점수 분리
      const feedValues = values
        .filter(v => v.set_id && v.option_id && !examSetIds.has(v.set_id))
        .map(v => ({
          setId: v.set_id!,
          optionId: v.option_id!,
          score: v.score,
        }));
      
      const examScores = values
        .filter(v => v.set_id && examSetIds.has(v.set_id) && v.score !== null)
        .map(v => ({
          setId: v.set_id!,
          score: v.score,
        }));
      
      result[feed.student_id] = {
        id: feed.id,
        attendanceStatus: (feed.attendance_status as 'present' | 'late' | 'absent') ?? 'present',
        absenceReason: feed.absence_reason ?? undefined,
        absenceReasonDetail: feed.absence_reason_detail ?? undefined,
        notifyParent: feed.notify_parent ?? false,
        isMakeup: feed.is_makeup ?? false,
        progressText: feed.progress_text ?? undefined,
        memoValues: (feed.memo_values as Record<string, string>) || {},
        feedValues,
        examScores,
      };
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getSavedFeeds error:', error);
    return { success: false, error: '저장된 피드를 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 테넌트 설정 조회
// ============================================================================

export async function getTenantSettings(): Promise<{
  success: boolean;
  data?: TenantSettings;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    const { data: tenant } = await supabase
      .from('tenants')
      .select('settings, plan, operation_mode')
      .eq('id', profile.tenant_id)
      .single();
    
    const { data: featureRows } = await supabase
      .from('tenant_features')
      .select('feature_key')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_enabled', true)
      .is('deleted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    const features = (featureRows || [])
      .map(f => f.feature_key)
      .filter((key): key is string => key !== null);
    
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    
    return {
      success: true,
      data: {
        progress_enabled: (settings.progress_enabled as boolean) ?? false,
        materials_enabled: (settings.materials_enabled as boolean) ?? false,
        exam_score_enabled: (settings.exam_score_enabled as boolean) ?? false,  // 🆕 추가
        makeup_defaults: (settings.makeup_defaults as Record<string, boolean>) ?? {
          '병결': true,
          '학교행사': true,
          '가사': false,
          '무단': false,
          '기타': true,
        },
        plan: (tenant?.plan as 'basic' | 'premium' | 'enterprise') ?? 'basic',
        features,
        operation_mode: (tenant?.operation_mode as 'solo' | 'team') ?? 'solo',
      },
    };
  } catch (error) {
    console.error('getTenantSettings error:', error);
    return { success: false, error: '설정을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 이전 진도 조회 (단일)
// ============================================================================

export async function getPreviousProgress(
  studentId: string,
  currentDate: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    // 인증 체크
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) return null;
    
    const { data } = await supabase
      .from('student_feeds')
      .select('progress_text')
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', studentId)
      .lt('feed_date', currentDate)
      .not('progress_text', 'is', null)
      .order('feed_date', { ascending: false })
      .limit(1)
      .single();
    
    return data?.progress_text || null;
  } catch {
    return null;
  }
}

// ============================================================================
// 이전 진도 일괄 조회 (최적화)
// ============================================================================

export async function getPreviousProgressBatch(
  studentIds: string[],
  currentDate: string
): Promise<Record<string, string>> {
  try {
    if (studentIds.length === 0) return {};
    
    const supabase = await createClient();
    
    // 인증 체크
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) return {};
    
    const { data, error } = await supabase
      .from('student_feeds')
      .select('student_id, progress_text, feed_date')
      .eq('tenant_id', profile.tenant_id)
      .in('student_id', studentIds)
      .lt('feed_date', currentDate)
      .not('progress_text', 'is', null)
      .order('feed_date', { ascending: false });
    
    if (error) throw error;
    
    const result: Record<string, string> = {};
    for (const row of data || []) {
      if (!row.student_id) continue;
      if (!result[row.student_id] && row.progress_text) {
        result[row.student_id] = row.progress_text;
      }
    }
    
    return result;
  } catch (error) {
    console.error('getPreviousProgressBatch error:', error);
    return {};
  }
}
