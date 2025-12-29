'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { SaveFeedPayload } from '../types';

// ============================================================================
// Types
// ============================================================================

interface BulkSaveResult {
  success: boolean;
  results: { 
    studentId: string; 
    success: boolean; 
    feedId?: string;
    error?: string;
  }[];
  totalSaved: number;
  totalFailed: number;
}

interface FeedUpsertData {
  tenant_id: string;
  class_id: string;
  student_id: string;
  feed_date: string;
  attendance_status: string;
  absence_reason: string | null;
  absence_reason_detail: string | null;
  notify_parent: boolean;
  is_makeup: boolean;
  needs_makeup: boolean;
  progress_text: string | null;
  memo_values: Record<string, string>;
  session_type: string;
  is_counted_in_stats: boolean;
  makeup_ticket_id?: string | null;
}

// ============================================================================
// Bulk 저장 (최적화 버전)
// ============================================================================

/**
 * 여러 학생의 피드를 한 번에 저장 (Bulk Insert/Update)
 * 
 * 기존: 학생 30명 = 150+ DB 쿼리
 * 최적화 후: 학생 30명 = 5~6 DB 쿼리
 */
export async function saveAllFeedsBulk(
  payloads: SaveFeedPayload[]
): Promise<BulkSaveResult> {
  if (payloads.length === 0) {
    return { success: true, results: [], totalSaved: 0, totalFailed: 0 };
  }

  try {
    const supabase = await createClient();
    
    // ========================================
    // 1. 인증 및 tenant 확인 (1회만)
    // ========================================
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        success: false,
        results: payloads.map(p => ({ 
          studentId: p.studentId, 
          success: false, 
          error: '로그인이 필요합니다' 
        })),
        totalSaved: 0,
        totalFailed: payloads.length,
      };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile?.tenant_id) {
      return {
        success: false,
        results: payloads.map(p => ({ 
          studentId: p.studentId, 
          success: false, 
          error: '프로필을 찾을 수 없습니다' 
        })),
        totalSaved: 0,
        totalFailed: payloads.length,
      };
    }
    
    const tenantId = profile.tenant_id;
    
    // ========================================
    // 2. 정규/보강 분리
    // ========================================
    const regularPayloads = payloads.filter(p => p.sessionType === 'regular');
    const makeupPayloads = payloads.filter(p => p.sessionType === 'makeup');
    
    const results: BulkSaveResult['results'] = [];
    
    // ========================================
    // 3. 정규 수업 피드 Bulk 처리
    // ========================================
    if (regularPayloads.length > 0) {
      const regularResults = await saveRegularFeedsBulk(
        supabase, 
        tenantId, 
        regularPayloads
      );
      results.push(...regularResults);
    }
    
    // ========================================
    // 4. 보강 수업 피드 Bulk 처리
    // ========================================
    if (makeupPayloads.length > 0) {
      const makeupResults = await saveMakeupFeedsBulk(
        supabase, 
        tenantId, 
        makeupPayloads
      );
      results.push(...makeupResults);
    }
    
    // ========================================
    // 5. 캐시 무효화
    // ========================================
    revalidatePath('/dashboard/teacher/feed-input');
    
    const totalSaved = results.filter(r => r.success).length;
    const totalFailed = results.filter(r => !r.success).length;
    
    return {
      success: totalFailed === 0,
      results,
      totalSaved,
      totalFailed,
    };
    
  } catch (error) {
    console.error('saveAllFeedsBulk error:', error);
    return {
      success: false,
      results: payloads.map(p => ({ 
        studentId: p.studentId, 
        success: false, 
        error: '저장 중 오류가 발생했습니다' 
      })),
      totalSaved: 0,
      totalFailed: payloads.length,
    };
  }
}

// ============================================================================
// 정규 수업 피드 Bulk 저장
// ============================================================================

async function saveRegularFeedsBulk(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  payloads: SaveFeedPayload[]
): Promise<BulkSaveResult['results']> {
  const results: BulkSaveResult['results'] = [];
  
  // 1. 기존 피드 조회 (IN 쿼리로 한 번에)
  const studentIds = payloads.map(p => p.studentId);
  const classId = payloads[0].classId;
  const feedDate = payloads[0].feedDate;
  
  const { data: existingFeeds, error: fetchError } = await supabase
    .from('student_feeds')
    .select('id, student_id')
    .eq('tenant_id', tenantId)
    .eq('class_id', classId)
    .eq('feed_date', feedDate)
    .eq('session_type', 'regular')
    .in('student_id', studentIds);
  
  if (fetchError) {
    console.error('기존 피드 조회 실패:', fetchError);
    return payloads.map(p => ({ 
      studentId: p.studentId, 
      success: false, 
      error: '기존 데이터 조회 실패' 
    }));
  }
  
  // 기존 피드 맵 생성
  const existingFeedMap = new Map<string, string>();
  existingFeeds?.forEach(f => {
    if (f.student_id) {
      existingFeedMap.set(f.student_id, f.id);
    }
  });
  
  // 2. INSERT할 것과 UPDATE할 것 분리
  const toInsert: FeedUpsertData[] = [];
  const toUpdate: { id: string; data: Partial<FeedUpsertData> }[] = [];
  
  for (const payload of payloads) {
    const existingId = existingFeedMap.get(payload.studentId);
    
    const feedData: FeedUpsertData = {
      tenant_id: tenantId,
      class_id: payload.classId,
      student_id: payload.studentId,
      feed_date: payload.feedDate,
      attendance_status: payload.attendanceStatus,
      absence_reason: payload.absenceReason || null,
      absence_reason_detail: payload.absenceReasonDetail || null,
      notify_parent: payload.notifyParent,
      is_makeup: false,
      needs_makeup: payload.needsMakeup ?? false,
      progress_text: payload.progressText || null,
      memo_values: payload.memoValues || {},
      session_type: 'regular',
      is_counted_in_stats: true,
    };
    
    if (existingId) {
      toUpdate.push({ 
        id: existingId, 
        data: {
          attendance_status: feedData.attendance_status,
          absence_reason: feedData.absence_reason,
          absence_reason_detail: feedData.absence_reason_detail,
          notify_parent: feedData.notify_parent,
          needs_makeup: feedData.needs_makeup,
          progress_text: feedData.progress_text,
          memo_values: feedData.memo_values,
        }
      });
    } else {
      toInsert.push(feedData);
    }
  }
  
  // 3. Bulk INSERT
  const insertedFeedIds = new Map<string, string>();
  
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('student_feeds')
      .insert(toInsert)
      .select('id, student_id');
    
    if (insertError) {
      console.error('Bulk insert 실패:', insertError);
      // 실패한 것들 기록
      toInsert.forEach(item => {
        results.push({ 
          studentId: item.student_id, 
          success: false, 
          error: '저장 실패' 
        });
      });
    } else {
      inserted?.forEach(f => {
        if (f.student_id) {
          insertedFeedIds.set(f.student_id, f.id);
          results.push({ 
            studentId: f.student_id, 
            success: true, 
            feedId: f.id 
          });
        }
      });
    }
  }
  
  // 4. Bulk UPDATE (개별 업데이트 - Supabase는 bulk update 지원 안 함)
  // 하지만 병렬 처리로 속도 개선
  const successfulUpdateIds: string[] = [];  // 성공한 업데이트 ID 추적
  
  if (toUpdate.length > 0) {
    const updatePromises = toUpdate.map(async ({ id, data }) => {
      const { error } = await supabase
        .from('student_feeds')
        .update(data)
        .eq('id', id);
      
      return { id, error };
    });
    
    const updateResults = await Promise.all(updatePromises);
    
    updateResults.forEach(({ id, error }) => {
      // id로 student_id 찾기
      let studentId = '';
      existingFeedMap.forEach((feedId, sId) => {
        if (feedId === id) studentId = sId;
      });
      
      if (error) {
        results.push({ studentId, success: false, error: '업데이트 실패' });
      } else {
        results.push({ studentId, success: true, feedId: id });
        successfulUpdateIds.push(id);  // 성공한 것만 추가
      }
    });
  }
  
  // 5. feed_values 처리
  // 5-1. 기존 feed_values 삭제 (성공한 업데이트만!)
  if (successfulUpdateIds.length > 0) {
    await supabase
      .from('feed_values')
      .delete()
      .in('feed_id', successfulUpdateIds);
  }
  
  // 5-2. 새 feed_values 삽입
  const allFeedValues: {
    feed_id: string;
    set_id: string;
    option_id: string;
    score: number | null;
  }[] = [];
  
  for (const payload of payloads) {
    if (payload.attendanceStatus === 'absent') continue;
    if (!payload.feedValues || payload.feedValues.length === 0) continue;
    
    // feedId 찾기
    const feedId = existingFeedMap.get(payload.studentId) 
      || insertedFeedIds.get(payload.studentId);
    
    if (!feedId) continue;
    
    payload.feedValues.forEach(v => {
      allFeedValues.push({
        feed_id: feedId,
        set_id: v.setId,
        option_id: v.optionId,
        score: v.score ?? null,
      });
    });
  }
  
  if (allFeedValues.length > 0) {
    const { error: valuesError } = await supabase
      .from('feed_values')
      .insert(allFeedValues);
    
    if (valuesError) {
      console.error('feed_values bulk insert 실패:', valuesError);
    }
  }
  
  return results;
}

// ============================================================================
// 보강 수업 피드 Bulk 저장
// ============================================================================

async function saveMakeupFeedsBulk(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  payloads: SaveFeedPayload[]
): Promise<BulkSaveResult['results']> {
  const results: BulkSaveResult['results'] = [];
  
  // 보강은 makeup_ticket_id 기준으로 조회
  const ticketIds = payloads
    .map(p => p.makeupTicketId)
    .filter((id): id is string => !!id);
  
  if (ticketIds.length === 0) {
    return payloads.map(p => ({ 
      studentId: p.studentId, 
      success: false, 
      error: '보강 티켓 ID가 없습니다' 
    }));
  }
  
  // 1. 기존 보강 피드 조회
  const { data: existingFeeds } = await supabase
    .from('student_feeds')
    .select('id, makeup_ticket_id')
    .in('makeup_ticket_id', ticketIds);
  
  const existingFeedMap = new Map<string, string>();
  existingFeeds?.forEach(f => {
    if (f.makeup_ticket_id) {
      existingFeedMap.set(f.makeup_ticket_id, f.id);
    }
  });
  
  // 2. INSERT/UPDATE 분리
  const toInsert: FeedUpsertData[] = [];
  const toUpdate: { id: string; data: Partial<FeedUpsertData> }[] = [];
  
  for (const payload of payloads) {
    if (!payload.makeupTicketId) {
      results.push({ 
        studentId: payload.studentId, 
        success: false, 
        error: '보강 티켓 ID가 없습니다' 
      });
      continue;
    }
    
    const existingId = existingFeedMap.get(payload.makeupTicketId);
    
    const feedData: FeedUpsertData = {
      tenant_id: tenantId,
      class_id: payload.classId,
      student_id: payload.studentId,
      feed_date: payload.feedDate,
      attendance_status: payload.attendanceStatus,
      absence_reason: null,
      absence_reason_detail: null,
      notify_parent: false,
      is_makeup: true,
      needs_makeup: false,
      progress_text: payload.progressText || null,
      memo_values: payload.memoValues || {},
      session_type: 'makeup',
      is_counted_in_stats: false,
      makeup_ticket_id: payload.makeupTicketId,
    };
    
    if (existingId) {
      toUpdate.push({
        id: existingId,
        data: {
          attendance_status: feedData.attendance_status,
          progress_text: feedData.progress_text,
          memo_values: feedData.memo_values,
        }
      });
    } else {
      toInsert.push(feedData);
    }
  }
  
  // 3. Bulk INSERT
  const insertedFeedIds = new Map<string, string>();
  
  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('student_feeds')
      .insert(toInsert)
      .select('id, student_id, makeup_ticket_id');
    
    if (insertError) {
      console.error('보강 피드 bulk insert 실패:', insertError);
      toInsert.forEach(item => {
        results.push({ 
          studentId: item.student_id, 
          success: false, 
          error: '저장 실패' 
        });
      });
    } else {
      inserted?.forEach(f => {
        if (f.student_id) {
          insertedFeedIds.set(f.student_id, f.id);
          results.push({ 
            studentId: f.student_id, 
            success: true, 
            feedId: f.id 
          });
        }
      });
    }
  }
  
  // 4. Bulk UPDATE
  const successfulUpdateIds: string[] = [];  // 성공한 업데이트 ID 추적
  
  if (toUpdate.length > 0) {
    const updatePromises = toUpdate.map(async ({ id, data }) => {
      const { error } = await supabase
        .from('student_feeds')
        .update(data)
        .eq('id', id);
      return { id, error };
    });
    
    const updateResults = await Promise.all(updatePromises);
    
    // 결과 매핑
    for (const payload of payloads) {
      if (!payload.makeupTicketId) continue;
      const feedId = existingFeedMap.get(payload.makeupTicketId);
      if (!feedId) continue;
      
      const updateResult = updateResults.find(r => r.id === feedId);
      if (updateResult?.error) {
        results.push({ 
          studentId: payload.studentId, 
          success: false, 
          error: '업데이트 실패' 
        });
      } else {
        results.push({ 
          studentId: payload.studentId, 
          success: true, 
          feedId 
        });
        successfulUpdateIds.push(feedId);  // 성공한 것만 추가
      }
    }
  }
  
  // 5. feed_values 처리 (성공한 업데이트만!)
  if (successfulUpdateIds.length > 0) {
    await supabase
      .from('feed_values')
      .delete()
      .in('feed_id', successfulUpdateIds);
  }
  
  const allFeedValues: {
    feed_id: string;
    set_id: string;
    option_id: string;
    score: number | null;
  }[] = [];
  
  for (const payload of payloads) {
    if (payload.attendanceStatus === 'absent') continue;
    if (!payload.feedValues || payload.feedValues.length === 0) continue;
    
    let feedId: string | undefined;
    if (payload.makeupTicketId) {
      feedId = existingFeedMap.get(payload.makeupTicketId) 
        || insertedFeedIds.get(payload.studentId);
    }
    
    if (!feedId) continue;
    
    payload.feedValues.forEach(v => {
      allFeedValues.push({
        feed_id: feedId!,
        set_id: v.setId,
        option_id: v.optionId,
        score: v.score ?? null,
      });
    });
  }
  
  if (allFeedValues.length > 0) {
    await supabase
      .from('feed_values')
      .insert(allFeedValues);
  }
  
  // 6. 보강 티켓 완료 처리
  const completedTicketIds = payloads
    .filter(p => p.makeupTicketId && results.find(r => r.studentId === p.studentId)?.success)
    .map(p => p.makeupTicketId!);
  
  if (completedTicketIds.length > 0) {
    const classId = payloads[0].classId;
    const feedDate = payloads[0].feedDate;
    
    await supabase
      .from('makeup_tickets')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_feed_date: feedDate,
        completed_class_id: classId,
      })
      .in('id', completedTicketIds);
  }
  
  return results;
}