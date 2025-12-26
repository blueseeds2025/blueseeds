'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { 
  SaveFeedPayload, 
  SaveFeedResponse, 
  ClassInfo, 
  ClassStudent,
  FeedOptionSet,
  SavedFeedData,
  TenantSettings
} from './types';

// ============================================================================
// 데이터 조회
// ============================================================================

// 교사가 담당하는 반 목록 조회
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
    
    // 프로필에서 tenant_id와 role 확인
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
    
    // 원장은 모든 반, 교사는 담당 반만
    if (profile.role === 'teacher') {
      // class_teachers 테이블에서 담당 반 조회
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

// 반에 속한 학생 목록 조회
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

// 피드 옵션 세트 조회 (교사 권한 필터링 포함)
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
    
    // 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 활성화된 피드 옵션 세트 조회
    const { data: sets, error: setsError } = await supabase
      .from('feed_option_sets')
      .select('id, name, set_key, is_scored, is_required')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at');
    
    if (setsError) throw setsError;
    
    // 교사별 권한 확인 (teacher_feed_permissions)
    let allowedSetIds: string[] | null = null;
    
    if (profile.role === 'teacher') {
      const { data: permissions } = await supabase
        .from('teacher_feed_permissions')
        .select('option_set_id, is_allowed')
        .eq('teacher_id', user.id);
      
      if (permissions && permissions.length > 0) {
        allowedSetIds = permissions
          .filter(p => p.is_allowed)
          .map(p => p.option_set_id);
      }
    }
    
    // 권한 필터링
    const filteredSets = allowedSetIds 
      ? sets?.filter(s => allowedSetIds!.includes(s.id))
      : sets;
    
    // 각 세트의 옵션 조회
    const result: FeedOptionSet[] = [];
    
    for (const set of filteredSets || []) {
      const { data: options } = await supabase
        .from('feed_options')
        .select('id, set_id, label, score, display_order')
        .eq('set_id', set.id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order');
      
      result.push({
        ...set,
        is_required: set.is_required ?? false,
        options: options || [],
      });
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getFeedOptionSets error:', error);
    return { success: false, error: '피드 항목을 불러오는데 실패했습니다' };
  }
}

// 특정 날짜의 저장된 피드 데이터 조회
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
    
    // daily_feeds 조회
    const { data: feeds, error: feedsError } = await supabase
      .from('daily_feeds')
      .select(`
        id,
        student_id,
        attendance_status,
        absence_reason,
        absence_reason_detail,
        notify_parent,
        is_makeup,
        progress_text,
        memo,
        status
      `)
      .eq('class_id', classId)
      .eq('feed_date', feedDate)
      .is('deleted_at', null);
    
    if (feedsError) throw feedsError;
    
    const result: Record<string, SavedFeedData> = {};
    
    for (const feed of feeds || []) {
      // 피드 값 조회
      const { data: values } = await supabase
        .from('daily_feed_values')
        .select('set_id, option_id, score')
        .eq('daily_feed_id', feed.id)
        .is('deleted_at', null);
      
      // 교재 사용 조회
      const { data: materials } = await supabase
        .from('daily_feed_materials')
        .select('id, material_name, quantity')
        .eq('daily_feed_id', feed.id)
        .is('deleted_at', null);
      
      result[feed.student_id] = {
        id: feed.id,
        attendanceStatus: feed.attendance_status as 'present' | 'absent',
        absenceReason: feed.absence_reason,
        absenceReasonDetail: feed.absence_reason_detail,
        notifyParent: feed.notify_parent ?? false,
        isMakeup: feed.is_makeup ?? false,
        progressText: feed.progress_text,
        memo: feed.memo,
        feedValues: (values || []).map(v => ({
          setId: v.set_id,
          optionId: v.option_id,
          score: v.score,
        })),
        materials: (materials || []).map(m => ({
          id: m.id,
          materialName: m.material_name,
          quantity: m.quantity,
        })),
      };
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getSavedFeeds error:', error);
    return { success: false, error: '저장된 피드를 불러오는데 실패했습니다' };
  }
}

// 이전 진도 조회 (placeholder용)
export async function getPreviousProgress(
  studentId: string,
  currentDate: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    
    const { data } = await supabase
      .from('daily_feeds')
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

// 테넌트 설정 조회 (진도/교재 ON/OFF)
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
      .select('settings')
      .eq('id', profile.tenant_id)
      .single();
    
    const settings = tenant?.settings as Record<string, boolean> || {};
    
    return {
      success: true,
      data: {
        progress_enabled: settings.progress_enabled ?? false,
        materials_enabled: settings.materials_enabled ?? false,
      },
    };
  } catch (error) {
    console.error('getTenantSettings error:', error);
    return { success: false, error: '설정을 불러오는데 실패했습니다' };
  }
}


// ============================================================================
// 저장
// ============================================================================

// 단일 학생 피드 저장
export async function saveFeed(payload: SaveFeedPayload): Promise<SaveFeedResponse> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    // 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // Idempotency 체크
    const { data: existingKey } = await supabase
      .from('idempotency_keys')
      .select('id, response_body')
      .eq('tenant_id', profile.tenant_id)
      .eq('key', payload.idempotencyKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (existingKey) {
      // 이미 처리된 요청 - 기존 결과 반환
      const cached = existingKey.response_body as SaveFeedResponse;
      return cached || { success: true, feedId: 'cached' };
    }
    
    // 기존 피드 확인 (upsert용)
    const { data: existingFeed } = await supabase
      .from('daily_feeds')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', payload.classId)
      .eq('student_id', payload.studentId)
      .eq('feed_date', payload.feedDate)
      .is('deleted_at', null)
      .single();
    
    let feedId: string;
    
    if (existingFeed) {
      // UPDATE
      const { error: updateError } = await supabase
        .from('daily_feeds')
        .update({
          attendance_status: payload.attendanceStatus,
          absence_reason: payload.absenceReason,
          absence_reason_detail: payload.absenceReasonDetail,
          notify_parent: payload.notifyParent,
          is_makeup: payload.isMakeup,
          progress_text: payload.progressText,
          memo: payload.memo,
          status: 'saved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingFeed.id);
      
      if (updateError) throw updateError;
      feedId = existingFeed.id;
      
      // 기존 값들 soft delete
      await supabase
        .from('daily_feed_values')
        .update({ deleted_at: new Date().toISOString() })
        .eq('daily_feed_id', feedId);
      
      await supabase
        .from('daily_feed_materials')
        .update({ deleted_at: new Date().toISOString() })
        .eq('daily_feed_id', feedId);
        
    } else {
      // INSERT
      const { data: newFeed, error: insertError } = await supabase
        .from('daily_feeds')
        .insert({
          tenant_id: profile.tenant_id,
          class_id: payload.classId,
          student_id: payload.studentId,
          teacher_id: user.id,
          feed_date: payload.feedDate,
          attendance_status: payload.attendanceStatus,
          absence_reason: payload.absenceReason,
          absence_reason_detail: payload.absenceReasonDetail,
          notify_parent: payload.notifyParent,
          is_makeup: payload.isMakeup,
          progress_text: payload.progressText,
          memo: payload.memo,
          status: 'saved',
          idempotency_key: payload.idempotencyKey,
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      feedId = newFeed.id;
    }
    
    // 피드 값 저장 (결석이 아닐 때만)
    if (payload.attendanceStatus === 'present' && payload.feedValues.length > 0) {
      const valueInserts = payload.feedValues.map(v => ({
        daily_feed_id: feedId,
        set_id: v.setId,
        option_id: v.optionId,
      }));
      
      const { error: valuesError } = await supabase
        .from('daily_feed_values')
        .insert(valueInserts);
      
      if (valuesError) throw valuesError;
    }
    
    // 교재 사용 저장
    if (payload.materials.length > 0) {
      const materialInserts = payload.materials.map(m => ({
        daily_feed_id: feedId,
        material_name: m.materialName,
        quantity: m.quantity,
      }));
      
      const { error: materialsError } = await supabase
        .from('daily_feed_materials')
        .insert(materialInserts);
      
      if (materialsError) throw materialsError;
    }
    
    // Idempotency 키 저장
    const response: SaveFeedResponse = { success: true, feedId };
    
    await supabase
      .from('idempotency_keys')
      .insert({
        tenant_id: profile.tenant_id,
        key: payload.idempotencyKey,
        request_path: '/feed/save',
        response_status: 200,
        response_body: response,
      });
    
    revalidatePath('/dashboard/teacher/feed-input');
    
    return response;
  } catch (error) {
    console.error('saveFeed error:', error);
    return { success: false, error: '저장 중 오류가 발생했습니다' };
  }
}

// 전체 저장 (여러 학생)
export async function saveAllFeeds(
  payloads: SaveFeedPayload[]
): Promise<{
  success: boolean;
  results: { studentId: string; success: boolean; error?: string }[];
}> {
  const results = await Promise.all(
    payloads.map(async (payload) => {
      const result = await saveFeed(payload);
      return {
        studentId: payload.studentId,
        success: result.success,
        error: result.error,
      };
    })
  );
  
  const allSuccess = results.every(r => r.success);
  
  return { success: allSuccess, results };
}


// ============================================================================
// 보강생 검색
// ============================================================================

// 보강생 검색 (현재 반에 없는 학생)
export async function searchMakeupStudents(
  classId: string,
  query: string
): Promise<{
  success: boolean;
  data?: ClassStudent[];
  error?: string;
}> {
  try {
    if (query.length < 2) {
      return { success: true, data: [] };
    }
    
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
    
    // 현재 반에 이미 있는 학생 ID
    const { data: currentMembers } = await supabase
      .from('class_members')
      .select('student_id')
      .eq('class_id', classId)
      .is('deleted_at', null);
    
    const currentIds = currentMembers?.map(m => m.student_id) || [];
    
    // 이름으로 검색 (현재 반 학생 제외)
    let searchQuery = supabase
      .from('students')
      .select('id, name, display_code')
      .eq('tenant_id', profile.tenant_id)
      .ilike('name', `%${query}%`)
      .is('deleted_at', null)
      .limit(10);
    
    if (currentIds.length > 0) {
      searchQuery = searchQuery.not('id', 'in', `(${currentIds.join(',')})`);
    }
    
    const { data, error } = await searchQuery;
    
    if (error) throw error;
    
    const students: ClassStudent[] = (data || []).map(s => ({
      id: s.id,
      name: s.name,
      display_code: s.display_code,
      class_id: classId,
      is_makeup: true,
    }));
    
    return { success: true, data: students };
  } catch (error) {
    console.error('searchMakeupStudents error:', error);
    return { success: false, error: '검색 중 오류가 발생했습니다' };
  }
}
