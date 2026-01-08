'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { SaveFeedPayload, SaveFeedResponse } from '../types';
import { handleMakeupTicket, completeMakeupTicket } from './feed-makeup.actions';

// ============================================================================
// 단일 학생 피드 저장
// ============================================================================

export async function saveFeed(payload: SaveFeedPayload): Promise<SaveFeedResponse> {
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
    
    const tenantId = profile.tenant_id;
    
    // 테넌트 기능 확인
    const { data: featureRows } = await supabase
      .from('tenant_features')
      .select('feature_key')
      .eq('tenant_id', tenantId)
      .eq('is_enabled', true)
      .is('deleted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    const enabledFeatures = (featureRows || [])
      .map(f => f.feature_key)
      .filter((key): key is string => key !== null);
    const hasMakeupSystem = enabledFeatures.includes('makeup_system');
    
    // Idempotency 체크
    const { data: existingKey } = await supabase
      .from('idempotency_keys')
      .select('id, response_body')
      .eq('tenant_id', tenantId)
      .eq('key', payload.idempotencyKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (existingKey?.response_body) {
      const cached = existingKey.response_body as unknown as SaveFeedResponse;
      return cached || { success: true, feedId: 'cached' };
    }
    
    let feedId: string;
    const isRegular = payload.sessionType === 'regular';
    
    if (isRegular) {
      // ========================================
      // 정규 수업 피드
      // ========================================
      
      const { data: existingFeed } = await supabase
        .from('student_feeds')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('class_id', payload.classId)
        .eq('student_id', payload.studentId)
        .eq('feed_date', payload.feedDate)
        .eq('session_type', 'regular')
        .single();
      
      if (existingFeed) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('student_feeds')
          .update({
            attendance_status: payload.attendanceStatus,
            absence_reason: payload.absenceReason,
            absence_reason_detail: payload.absenceReasonDetail,
            notify_parent: payload.notifyParent,
            is_makeup: false,
            needs_makeup: payload.needsMakeup ?? false,
            progress_text: payload.progressText,
            memo_values: payload.memoValues || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFeed.id);
        
        if (updateError) throw updateError;
        feedId = existingFeed.id;
        
        await supabase
          .from('feed_values')
          .delete()
          .eq('feed_id', feedId);
        
        if (hasMakeupSystem) {
          await handleMakeupTicket(supabase, {
            feedId,
            tenantId,
            studentId: payload.studentId,
            classId: payload.classId,
            feedDate: payload.feedDate,
            absenceReason: payload.absenceReason,
            needsMakeup: payload.needsMakeup ?? false,
            attendanceStatus: payload.attendanceStatus,
          });
        }
          
      } else {
        // INSERT
        const { data: newFeed, error: insertError } = await supabase
          .from('student_feeds')
          .insert({
            tenant_id: tenantId,
            class_id: payload.classId,
            student_id: payload.studentId,
            feed_date: payload.feedDate,
            attendance_status: payload.attendanceStatus,
            absence_reason: payload.absenceReason,
            absence_reason_detail: payload.absenceReasonDetail,
            notify_parent: payload.notifyParent,
            is_makeup: false,
            needs_makeup: payload.needsMakeup ?? false,
            progress_text: payload.progressText,
            memo_values: payload.memoValues || {},
            session_type: 'regular',
            is_counted_in_stats: true,
          })
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        feedId = newFeed.id;
        
        if (hasMakeupSystem) {
          await handleMakeupTicket(supabase, {
            feedId,
            tenantId,
            studentId: payload.studentId,
            classId: payload.classId,
            feedDate: payload.feedDate,
            absenceReason: payload.absenceReason,
            needsMakeup: payload.needsMakeup ?? false,
            attendanceStatus: payload.attendanceStatus,
          });
        }
      }
      
    } else {
      // ========================================
      // 보강 수업 피드
      // ========================================
      
      console.log('Saving makeup feed:', { 
        studentId: payload.studentId, 
        makeupTicketId: payload.makeupTicketId,
        sessionType: payload.sessionType 
      });
      
      if (!payload.makeupTicketId) {
        console.error('makeupTicketId is missing!');
        return { success: false, error: '보강 티켓 ID가 필요합니다' };
      }
      
      const { data: existingMakeupFeed } = await supabase
        .from('student_feeds')
        .select('id')
        .eq('makeup_ticket_id', payload.makeupTicketId)
        .single();
      
      if (existingMakeupFeed) {
        // UPDATE
        const { error: updateError } = await supabase
          .from('student_feeds')
          .update({
            attendance_status: payload.attendanceStatus,
            progress_text: payload.progressText,
            memo_values: payload.memoValues || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMakeupFeed.id);
        
        if (updateError) throw updateError;
        feedId = existingMakeupFeed.id;
        
        await supabase
          .from('feed_values')
          .delete()
          .eq('feed_id', feedId);
        
        await completeMakeupTicket(
          supabase,
          payload.makeupTicketId,
          payload.feedDate,
          payload.classId
        );
          
      } else {
        // INSERT
        const { data: newFeed, error: insertError } = await supabase
          .from('student_feeds')
          .insert({
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
            progress_text: payload.progressText,
            memo_values: payload.memoValues || {},
            session_type: 'makeup',
            is_counted_in_stats: false,
            makeup_ticket_id: payload.makeupTicketId,
          })
          .select('id')
          .single();
        
        if (insertError) throw insertError;
        feedId = newFeed.id;
        
        await completeMakeupTicket(
          supabase,
          payload.makeupTicketId,
          payload.feedDate,
          payload.classId
        );
      }
    }
    
    // ========================================
    // 피드 값 저장 (일반 피드 + 시험 점수)
    // ========================================
    if (payload.attendanceStatus !== 'absent') {
      const valueInserts: {
        feed_id: string;
        set_id: string;
        option_id: string | null;
        score: number | null;
      }[] = [];
      
      // 일반 피드 값
      if (payload.feedValues && payload.feedValues.length > 0) {
        for (const v of payload.feedValues) {
          valueInserts.push({
            feed_id: feedId,
            set_id: v.setId,
            option_id: v.optionId,
            score: v.score ?? null,
          });
        }
      }
      
      // 시험 점수 (option_id는 null, score만 저장)
      if (payload.examScores && payload.examScores.length > 0) {
        for (const exam of payload.examScores) {
          valueInserts.push({
            feed_id: feedId,
            set_id: exam.setId,
            option_id: null,
            score: exam.score,
          });
        }
      }
      
      if (valueInserts.length > 0) {
        const { error: valuesError } = await supabase
          .from('feed_values')
          .insert(valueInserts);
        
        if (valuesError) {
          console.error('feed_values insert error:', valuesError);
          throw valuesError;
        }
      }
    }
    
    // Idempotency 키 저장
    const response: SaveFeedResponse = { success: true, feedId };
    
    await supabase
      .from('idempotency_keys')
      .insert({
        tenant_id: tenantId,
        key: payload.idempotencyKey,
        request_path: '/feed/save',
        response_status: 200,
        response_body: JSON.parse(JSON.stringify(response)),
      });
    
    // ========================================
    // 진도 저장 (feed_progress_entries)
    // ========================================
    if (payload.progressEntries && payload.progressEntries.length > 0 && payload.attendanceStatus !== 'absent') {
      // 기존 진도 삭제 (soft delete)
      await supabase
        .from('feed_progress_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('student_id', payload.studentId)
        .eq('feed_date', payload.feedDate);
      
      // 새 진도 저장
      const progressInserts = payload.progressEntries.map(entry => ({
        tenant_id: tenantId,
        student_id: payload.studentId,
        feed_date: payload.feedDate,
        textbook_id: entry.textbookId,
        end_page_int: entry.endPageInt,
        end_page_text: entry.endPageText || null,
        created_by: user.id,
      }));
      
      const { error: progressError } = await supabase
        .from('feed_progress_entries')
        .insert(progressInserts);
      
      if (progressError) {
        console.error('feed_progress_entries insert error:', progressError);
      }
    }
    
    // ========================================
    // ✅ 캐시 무효화
    // ========================================
    
    // 피드 데이터는 캐시하지 않으므로 revalidatePath만 사용
    // 설정이 바뀌면 revalidateTag 사용 (아래 invalidateFeedSettings 함수)
    revalidatePath('/dashboard/teacher/feed-input');
    
    return response;
  } catch (error) {
    console.error('saveFeed error:', error);
    return { success: false, error: '저장 중 오류가 발생했습니다' };
  }
}

// ============================================================================
// 전체 저장 (여러 학생)
// ============================================================================

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


