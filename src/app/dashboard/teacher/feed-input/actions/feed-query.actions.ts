'use server';

import { createClient } from '@/lib/supabase/server';
import { 
  ClassInfo, 
  ClassStudent,
  FeedOptionSet,
  SavedFeedData,
  TenantSettings
} from './types';

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
        .eq('teacher_id', user.id)
        .is('deleted_at', null);
      
      const classIds = assignments?.map(a => a.class_id) || [];
      
      if (classIds.length === 0) {
        return { success: true, data: [] };
      }
      
      query = query.in('id', classIds);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('getTeacherClasses error:', error);
    return { success: false, error: '반 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 반에 속한 학생 목록 조회
// ============================================================================

export async function getClassStudents(classId: string): Promise<{
  success: boolean;
  data?: ClassStudent[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('class_members')
      .select(`
        student_id,
        students (
          id,
          name,
          display_code
        )
      `)
      .eq('class_id', classId)
      .is('deleted_at', null);
    
    if (error) throw error;
    
    const students: ClassStudent[] = (data || [])
      .filter(item => item.students)
      .map(item => ({
        id: (item.students as any).id,
        name: (item.students as any).name,
        display_code: (item.students as any).display_code,
        class_id: classId,
        is_makeup: false,
      }));
    
    return { success: true, data: students };
  } catch (error) {
    console.error('getClassStudents error:', error);
    return { success: false, error: '학생 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 피드 옵션 세트 조회 (교사 권한 필터링 포함)
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
    
    const { data: sets, error: setsError } = await supabase
      .from('feed_option_sets')
      .select('id, name, set_key, is_scored, is_required')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
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
    const optionsBySetId = (allOptions || []).reduce((acc, opt) => {
      if (!acc[opt.set_id]) acc[opt.set_id] = [];
      acc[opt.set_id].push(opt);
      return acc;
    }, {} as Record<string, typeof allOptions>);

    // 결과 조합
    const result: FeedOptionSet[] = filteredSets.map(set => ({
      ...set,
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
      .eq('class_id', classId)
      .eq('feed_date', feedDate);
    
    if (feedsError) throw feedsError;
    
    const feedIds = (feeds || []).map(f => f.id);
    let feedValuesMap: Record<string, any[]> = {};
    
    if (feedIds.length > 0) {
      const { data: values, error: valuesError } = await supabase
        .from('feed_values')
        .select('feed_id, set_id, option_id, score')
        .in('feed_id', feedIds);
      
      if (valuesError) throw valuesError;
      
      for (const v of values || []) {
        if (!feedValuesMap[v.feed_id]) {
          feedValuesMap[v.feed_id] = [];
        }
        feedValuesMap[v.feed_id].push(v);
      }
    }
    
    const result: Record<string, SavedFeedData> = {};
    
    for (const feed of feeds || []) {
      const values = feedValuesMap[feed.id] || [];
      
      result[feed.student_id] = {
        id: feed.id,
        attendanceStatus: feed.attendance_status as 'present' | 'late' | 'absent',
        absenceReason: feed.absence_reason,
        absenceReasonDetail: feed.absence_reason_detail,
        notifyParent: feed.notify_parent ?? false,
        isMakeup: feed.is_makeup ?? false,
        progressText: feed.progress_text,
        memoValues: (feed.memo_values as Record<string, string>) || {},
        feedValues: values.map(v => ({
          setId: v.set_id,
          optionId: v.option_id,
          score: v.score,
        })),
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
      .select('settings, plan')
      .eq('id', profile.tenant_id)
      .single();
    
    const { data: featureRows } = await supabase
      .from('tenant_features')
      .select('feature_key')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_enabled', true)
      .is('deleted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    const features = featureRows?.map(f => f.feature_key) || [];
    const settings = tenant?.settings as Record<string, any> || {};
    
    return {
      success: true,
      data: {
        progress_enabled: settings.progress_enabled ?? false,
        materials_enabled: settings.materials_enabled ?? false,
        makeup_defaults: settings.makeup_defaults ?? {
          '병결': true,
          '학교행사': true,
          '가사': false,
          '무단': false,
          '기타': true,
        },
        plan: (tenant?.plan as 'basic' | 'premium' | 'enterprise') ?? 'basic',
        features,
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
    
    const { data } = await supabase
      .from('student_feeds')
      .select('progress_text')
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
    
    const { data, error } = await supabase
      .from('student_feeds')
      .select('student_id, progress_text, feed_date')
      .in('student_id', studentIds)
      .lt('feed_date', currentDate)
      .not('progress_text', 'is', null)
      .order('feed_date', { ascending: false });
    
    if (error) throw error;
    
    const result: Record<string, string> = {};
    for (const row of data || []) {
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
