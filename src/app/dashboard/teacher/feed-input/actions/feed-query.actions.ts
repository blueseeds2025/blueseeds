'use server';

import { createClient } from '@/lib/supabase/server';
import { 
  ClassInfo, 
  ClassStudent,
  FeedOptionSet,
  FeedOption,
  ExamType,
  SavedFeedData,
  TenantSettings,
  Textbook,
  ProgressEntry,
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
// 반에 속한 학생 목록 조회 (선택한 날짜 요일 기준 - enrollment_schedule_assignments)
// ============================================================================

export async function getClassStudents(classId: string, feedDate?: string): Promise<{
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
    
    // feedDate가 있으면 그 날짜의 요일, 없으면 오늘
    const targetDate = feedDate ? new Date(feedDate + 'T00:00:00') : new Date();
    const dayOfWeek = targetDate.getDay();
    
    // 1. 해당 반의 해당 요일 스케줄 조회
    const { data: schedules, error: scheduleError } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', classId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .is('deleted_at', null);
    
    if (scheduleError) throw scheduleError;
    
    // 오늘 해당 반 스케줄이 없으면 빈 배열
    if (!schedules || schedules.length === 0) {
      return { success: true, data: [] };
    }
    
    const scheduleIds = schedules.map(s => s.id);
    
    // 2. 해당 스케줄에 배정된 학생 조회
    const { data, error } = await supabase
      .from('enrollment_schedule_assignments')
      .select(`
        student_id,
        students (
          id,
          name,
          display_code
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .in('class_schedule_id', scheduleIds)
      .is('end_date', null)
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
    
    // ✅ student_feeds에는 deleted_at 컬럼이 없으므로 조건 제거
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
    const studentIds = (feeds || []).map(f => f.student_id).filter((id): id is string => !!id);
    const feedValuesMap: Record<string, { set_id: string | null; option_id: string | null; score: number | null }[]> = {};
    
    if (feedIds.length > 0) {
      // ✅ feed_values에는 deleted_at 컬럼이 없으므로 조건 제거
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
    
    // 🆕 저장된 진도 데이터 조회 (feed_progress_entries)
    const progressEntriesMap: Record<string, ProgressEntry[]> = {};
    
    if (studentIds.length > 0) {
      const { data: progressData, error: progressError } = await supabase
        .from('feed_progress_entries')
        .select(`
          student_id,
          textbook_id,
          end_page_int,
          end_page_text,
          textbooks (
            id,
            title,
            total_pages
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('student_id', studentIds)
        .eq('feed_date', feedDate)
        .is('deleted_at', null);
      
      if (!progressError && progressData) {
        for (const row of progressData) {
          if (!row.student_id || !row.textbook_id) continue;
          
          const textbook = row.textbooks as { id: string; title: string; total_pages: number | null } | null;
          if (!textbook) continue;
          
          if (!progressEntriesMap[row.student_id]) {
            progressEntriesMap[row.student_id] = [];
          }
          
          progressEntriesMap[row.student_id].push({
            textbookId: textbook.id,
            textbookTitle: textbook.title,
            totalPages: textbook.total_pages,
            endPageInt: row.end_page_int,
            endPageText: row.end_page_text || '',
          });
        }
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
        progressEntries: progressEntriesMap[feed.student_id] || [],  // 🆕 저장된 진도 추가
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
    
    // ✅ student_feeds에는 deleted_at 컬럼이 없으므로 조건 제거
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
    
    // ✅ student_feeds에는 deleted_at 컬럼이 없으므로 조건 제거
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

// ============================================================================
// 교재 목록 조회 (피드 입력용)
// ============================================================================

export async function getTextbooksForFeed(): Promise<{
  success: boolean;
  data?: Textbook[];
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
      .from('textbooks')
      .select('id, title, total_pages')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    return { success: true, data: data as Textbook[] };
  } catch (error) {
    console.error('getTextbooksForFeed error:', error);
    return { success: false, error: '교재 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 이전 진도 조회 (교재별) - feed_progress_entries 테이블
// ============================================================================

export async function getPreviousProgressEntries(
  studentId: string,
  currentDate: string
): Promise<ProgressEntry[]> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) return [];
    
    // 학생의 가장 최근 진도 기록 조회 (교재별)
    const { data, error } = await supabase
      .from('feed_progress_entries')
      .select(`
        textbook_id,
        end_page_int,
        end_page_text,
        feed_date,
        textbooks (
          id,
          title,
          total_pages
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', studentId)
      .lt('feed_date', currentDate)
      .is('deleted_at', null)
      .order('feed_date', { ascending: false });
    
    if (error) throw error;
    
    // 교재별로 가장 최근 기록만 추출
    const latestByTextbook: Record<string, ProgressEntry> = {};
    
    for (const row of data || []) {
      if (!row.textbook_id || latestByTextbook[row.textbook_id]) continue;
      
      const textbook = row.textbooks as { id: string; title: string; total_pages: number | null } | null;
      if (!textbook) continue;
      
      latestByTextbook[row.textbook_id] = {
        textbookId: textbook.id,
        textbookTitle: textbook.title,
        totalPages: textbook.total_pages,
        endPageInt: row.end_page_int,
        endPageText: row.end_page_text || '',
      };
    }
    
    return Object.values(latestByTextbook);
  } catch (error) {
    console.error('getPreviousProgressEntries error:', error);
    return [];
  }
}

// ============================================================================
// 이전 진도 일괄 조회 (교재별) - 여러 학생
// ============================================================================

export async function getPreviousProgressEntriesBatch(
  studentIds: string[],
  currentDate: string
): Promise<Record<string, ProgressEntry[]>> {
  try {
    if (studentIds.length === 0) return {};
    
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) return {};
    
    const { data, error } = await supabase
      .from('feed_progress_entries')
      .select(`
        student_id,
        textbook_id,
        end_page_int,
        end_page_text,
        feed_date,
        textbooks (
          id,
          title,
          total_pages
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .in('student_id', studentIds)
      .lt('feed_date', currentDate)
      .is('deleted_at', null)
      .order('feed_date', { ascending: false });
    
    if (error) throw error;
    
    // 학생별 + 교재별로 가장 최근 기록만 추출
    const result: Record<string, Record<string, ProgressEntry>> = {};
    
    for (const row of data || []) {
      if (!row.student_id || !row.textbook_id) continue;
      
      if (!result[row.student_id]) {
        result[row.student_id] = {};
      }
      
      // 이미 해당 교재의 기록이 있으면 스킵 (최신 기록 유지)
      if (result[row.student_id][row.textbook_id]) continue;
      
      const textbook = row.textbooks as { id: string; title: string; total_pages: number | null } | null;
      if (!textbook) continue;
      
      result[row.student_id][row.textbook_id] = {
        textbookId: textbook.id,
        textbookTitle: textbook.title,
        totalPages: textbook.total_pages,
        endPageInt: row.end_page_int,
        endPageText: row.end_page_text || '',
      };
    }
    
    // Record<string, ProgressEntry[]> 형태로 변환
    const finalResult: Record<string, ProgressEntry[]> = {};
    for (const [studentId, textbookMap] of Object.entries(result)) {
      finalResult[studentId] = Object.values(textbookMap);
    }
    
    return finalResult;
  } catch (error) {
    console.error('getPreviousProgressEntriesBatch error:', error);
    return {};
  }
}

// ============================================================================
// 저장된 진도 조회 (교재별) - 특정 날짜
// ============================================================================

export async function getSavedProgressEntries(
  studentId: string,
  feedDate: string
): Promise<ProgressEntry[]> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) return [];
    
    const { data, error } = await supabase
      .from('feed_progress_entries')
      .select(`
        textbook_id,
        end_page_int,
        end_page_text,
        textbooks (
          id,
          title,
          total_pages
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', studentId)
      .eq('feed_date', feedDate)
      .is('deleted_at', null);
    
    if (error) throw error;
    
    return (data || [])
      .filter(row => row.textbooks)
      .map(row => {
        const textbook = row.textbooks as { id: string; title: string; total_pages: number | null };
        return {
          textbookId: textbook.id,
          textbookTitle: textbook.title,
          totalPages: textbook.total_pages,
          endPageInt: row.end_page_int,
          endPageText: row.end_page_text || '',
        };
      });
  } catch (error) {
    console.error('getSavedProgressEntries error:', error);
    return [];
  }
}

// ============================================================================
// 🚀 통합 API: 피드 페이지 초기 설정 (1회 호출로 4개 → 1개)
// ============================================================================

export interface FeedPageSettings {
  classes: ClassInfo[];
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];
  tenantSettings: TenantSettings;
}

export async function getFeedPageSettings(): Promise<{
  success: boolean;
  data?: FeedPageSettings;
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
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    const tenantId = profile.tenant_id;
    
    // 🚀 병렬로 모든 데이터 조회
    const [
      classesResult,
      optionSetsResult,
      examSetsResult,
      textbooksResult,
      tenantResult,
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
        
        if (profile.role === 'teacher') {
          const { data: assignments } = await supabase
            .from('class_teachers')
            .select('class_id')
            .eq('tenant_id', tenantId)
            .eq('teacher_id', user.id)
            .eq('is_active', true)
            .is('deleted_at', null);
          
          const classIds = (assignments || [])
            .map(a => a.class_id)
            .filter((id): id is string => id !== null);
          
          if (classIds.length === 0) {
            return { data: [], error: null };
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
      
      // 3. 시험 타입 (exam_score 타입)
      supabase
        .from('feed_option_sets')
        .select('id, name, set_key')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .eq('type', 'exam_score')
        .order('created_at'),
      
      // 4. 교재 목록
      supabase
        .from('textbooks')
        .select('id, title, total_pages')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true }),
      
      // 5. 테넌트 설정
      supabase
        .from('tenants')
        .select('settings, plan, operation_mode')
        .eq('id', tenantId)
        .single(),
      
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
    
    // 옵션 세트 처리 (옵션도 한번에 조회)
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
    
    // 옵션셋별로 옵션 그룹핑
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
    const examTypes: ExamType[] = (examSetsResult.data || []).map(s => ({
      id: s.id,
      name: s.name,
      set_key: s.set_key,
    }));
    
    // 교재 처리
    const textbooks: Textbook[] = (textbooksResult.data || []).map(t => ({
      id: t.id,
      title: t.title,
      total_pages: t.total_pages,
    }));
    
    // 테넌트 설정 처리
    const features = (featuresResult.data || [])
      .map(f => f.feature_key)
      .filter((key): key is string => key !== null);
    
    const settings = (tenantResult.data?.settings as Record<string, unknown>) || {};
    
    const tenantSettings: TenantSettings = {
      progress_enabled: (settings.progress_enabled as boolean) ?? false,
      materials_enabled: (settings.materials_enabled as boolean) ?? false,
      exam_score_enabled: (settings.exam_score_enabled as boolean) ?? false,
      makeup_defaults: (settings.makeup_defaults as Record<string, boolean>) ?? {
        '병결': true,
        '학교행사': true,
        '가사': false,
        '무단': false,
        '기타': true,
      },
      plan: (tenantResult.data?.plan as 'basic' | 'premium' | 'enterprise') ?? 'basic',
      features,
      operation_mode: (tenantResult.data?.operation_mode as 'solo' | 'team') ?? 'solo',
    };
    
    return {
      success: true,
      data: {
        classes,
        optionSets,
        examTypes,
        textbooks,
        tenantSettings,
      },
    };
  } catch (error) {
    console.error('getFeedPageSettings error:', error);
    return { success: false, error: '설정을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 🚀 통합 API: 피드 페이지 데이터 (반/날짜별, 1회 호출로 4개 → 1개)
// ============================================================================

export interface FeedPageData {
  students: ClassStudent[];
  savedFeeds: Record<string, SavedFeedData>;
  previousProgressMap: Record<string, string>;
  previousProgressEntriesMap: Record<string, ProgressEntry[]>;
}

export async function getFeedPageData(
  classId: string,
  feedDate: string,
  progressEnabled: boolean = false,
  hasTextbooks: boolean = false
): Promise<{
  success: boolean;
  data?: FeedPageData;
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
    
    const tenantId = profile.tenant_id;
    
    // 요일 계산
    const targetDate = new Date(feedDate + 'T00:00:00');
    const dayOfWeek = targetDate.getDay();
    
    // 1. 해당 반의 해당 요일 스케줄 조회
    const { data: schedules } = await supabase
      .from('class_schedules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .is('deleted_at', null);
    
    if (!schedules || schedules.length === 0) {
      return {
        success: true,
        data: {
          students: [],
          savedFeeds: {},
          previousProgressMap: {},
          previousProgressEntriesMap: {},
        },
      };
    }
    
    const scheduleIds = schedules.map(s => s.id);
    
    // 2. 학생 목록 조회
    const { data: assignmentsData } = await supabase
      .from('enrollment_schedule_assignments')
      .select(`
        student_id,
        students (
          id,
          name,
          display_code
        )
      `)
      .eq('tenant_id', tenantId)
      .in('class_schedule_id', scheduleIds)
      .is('end_date', null)
      .is('deleted_at', null);
    
    const students: ClassStudent[] = (assignmentsData || [])
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
    
    if (students.length === 0) {
      return {
        success: true,
        data: {
          students: [],
          savedFeeds: {},
          previousProgressMap: {},
          previousProgressEntriesMap: {},
        },
      };
    }
    
    const studentIds = students.map(s => s.id);
    
    // 3. 시험 타입 ID 조회 (저장된 피드에서 exam_score 구분용)
    const { data: examSets } = await supabase
      .from('feed_option_sets')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('type', 'exam_score')
      .is('deleted_at', null);
    
    const examSetIds = new Set((examSets || []).map(s => s.id));
    
    // ✅ student_feeds 먼저 조회해서 feedIds 확보
    const { data: savedFeedsData } = await supabase
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
      .eq('tenant_id', tenantId)
      .eq('class_id', classId)
      .eq('feed_date', feedDate)
      .in('student_id', studentIds);
    
    const feedIds = (savedFeedsData || []).map(f => f.id);
    
    // 🚀 병렬로 나머지 데이터 조회
    const [
      feedValuesResult,
      previousProgressResult,
      previousEntriesResult,
    ] = await Promise.all([
      // ✅ feed_values에는 deleted_at 컬럼이 없으므로 조건 제거
      feedIds.length > 0
        ? supabase
            .from('feed_values')
            .select('feed_id, set_id, option_id, score')
            .in('feed_id', feedIds)
        : Promise.resolve({ data: [] }),
      
      // 이전 진도 (조건부) - ✅ student_feeds에는 deleted_at 없음
      progressEnabled
        ? supabase
            .from('student_feeds')
            .select('student_id, progress_text, feed_date')
            .eq('tenant_id', tenantId)
            .in('student_id', studentIds)
            .lt('feed_date', feedDate)
            .not('progress_text', 'is', null)
            .order('feed_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      
      // 이전 진도 엔트리 (조건부)
      progressEnabled && hasTextbooks
        ? supabase
            .from('feed_progress_entries')
            .select(`
              student_id,
              textbook_id,
              end_page_int,
              end_page_text,
              feed_date,
              textbooks (
                id,
                title,
                total_pages
              )
            `)
            .eq('tenant_id', tenantId)
            .in('student_id', studentIds)
            .lt('feed_date', feedDate)
            .is('deleted_at', null)
            .order('feed_date', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    
    // 저장된 피드 처리
    const savedFeeds: Record<string, SavedFeedData> = {};
    const feedIdToStudentId: Record<string, string> = {};
    
    for (const feed of savedFeedsData || []) {
      if (!feed.student_id) continue;
      feedIdToStudentId[feed.id] = feed.student_id;
      
      // 메모 파싱
      let memoValues: Record<string, string> = { 'default': '' };
      const memoData = feed.memo_values;
      if (memoData) {
        if (typeof memoData === 'object' && memoData !== null) {
          memoValues = memoData as Record<string, string>;
        } else if (typeof memoData === 'string') {
          try {
            const parsed = JSON.parse(memoData);
            if (typeof parsed === 'object' && parsed !== null) {
              memoValues = parsed;
            } else if (typeof parsed === 'string') {
              memoValues = { 'default': parsed };
            }
          } catch {
            memoValues = { 'default': memoData };
          }
        }
      }
      
      savedFeeds[feed.student_id] = {
        id: feed.id,
        attendanceStatus: (feed.attendance_status as 'present' | 'absent' | 'late') ?? 'present',
        absenceReason: feed.absence_reason ?? undefined,
        absenceReasonDetail: feed.absence_reason_detail ?? undefined,
        notifyParent: feed.notify_parent ?? false,
        isMakeup: feed.is_makeup ?? false,
        progressText: feed.progress_text ?? undefined,
        memoValues,
        feedValues: [],
        examScores: [],
      };
    }
    
    // 피드 값 처리
    for (const value of feedValuesResult.data || []) {
      if (!value.feed_id || !value.set_id) continue;
      
      const studentId = feedIdToStudentId[value.feed_id];
      if (!studentId || !savedFeeds[studentId]) continue;
      
      if (examSetIds.has(value.set_id)) {
        // 시험 점수
        if (value.score !== null) {
          savedFeeds[studentId].examScores = savedFeeds[studentId].examScores || [];
          savedFeeds[studentId].examScores!.push({
            setId: value.set_id,
            score: value.score,
          });
        }
      } else {
        // 일반 피드 값
        if (value.option_id) {
          savedFeeds[studentId].feedValues.push({
            setId: value.set_id,
            optionId: value.option_id,
          });
        }
      }
    }
    
    // 이전 진도 처리
    const previousProgressMap: Record<string, string> = {};
    for (const row of previousProgressResult.data || []) {
      if (!row.student_id || previousProgressMap[row.student_id]) continue;
      if (row.progress_text) {
        previousProgressMap[row.student_id] = row.progress_text;
      }
    }
    
    // 이전 진도 엔트리 처리
    const previousProgressEntriesMap: Record<string, ProgressEntry[]> = {};
    const seenTextbooks: Record<string, Set<string>> = {};
    
    for (const row of previousEntriesResult.data || []) {
      if (!row.student_id || !row.textbook_id) continue;
      
      if (!seenTextbooks[row.student_id]) {
        seenTextbooks[row.student_id] = new Set();
      }
      
      if (seenTextbooks[row.student_id].has(row.textbook_id)) continue;
      seenTextbooks[row.student_id].add(row.textbook_id);
      
      const textbook = row.textbooks as { id: string; title: string; total_pages: number | null } | null;
      if (!textbook) continue;
      
      if (!previousProgressEntriesMap[row.student_id]) {
        previousProgressEntriesMap[row.student_id] = [];
      }
      
      previousProgressEntriesMap[row.student_id].push({
        textbookId: textbook.id,
        textbookTitle: textbook.title,
        totalPages: textbook.total_pages,
        endPageInt: row.end_page_int,
        endPageText: row.end_page_text || '',
      });
    }
    
    return {
      success: true,
      data: {
        students,
        savedFeeds,
        previousProgressMap,
        previousProgressEntriesMap,
      },
    };
  } catch (error) {
    console.error('getFeedPageData error:', error);
    return { success: false, error: '데이터를 불러오는데 실패했습니다' };
  }
}