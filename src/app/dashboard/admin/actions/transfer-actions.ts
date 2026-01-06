'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ============================================================================
// 타입 정의
// ============================================================================

export type TransferRequest = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  effectiveDate: string;
  fromClassName: string;
  fromClassColor: string | null;
  fromTeacherName: string;
  toClassName: string;
  toClassColor: string | null;
  toTeacherName: string;
  fromDayOfWeek: number;
  fromStartTime: string;
  toDayOfWeek: number;
  toStartTime: string;
  scope: 'this_day' | 'same_group';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedByName: string;
  createdAt: string;
  reviewNote: string | null;
};

export type ActionResult<T = void> = {
  ok: boolean;
  message?: string;
  data?: T;
};

// ============================================================================
// 승인 요청 생성 (교사가 다른 선생님 반으로 이동 시도할 때)
// ============================================================================

export async function createTransferRequest(input: {
  studentId: string;
  effectiveDate: string;
  fromScheduleId: string;
  toScheduleId: string;
  scope: 'this_day' | 'same_group';
  groupKey?: string | null;
  reason?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: '로그인이 필요합니다' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { ok: false, message: '프로필을 찾을 수 없습니다' };
    }

    // 스케줄 정보 + 스냅샷용 데이터 조회
    const { data: fromSchedule } = await supabase
      .from('class_schedules')
      .select(`
        id, class_id, day_of_week, start_time,
        classes (id, name, color)
      `)
      .eq('id', input.fromScheduleId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    const { data: toSchedule } = await supabase
      .from('class_schedules')
      .select(`
        id, class_id, day_of_week, start_time,
        classes (id, name, color)
      `)
      .eq('id', input.toScheduleId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!fromSchedule || !toSchedule) {
      return { ok: false, message: '스케줄 정보를 찾을 수 없습니다' };
    }

    // 담당 교사 조회
    const { data: fromTeacher } = await supabase
      .from('class_teachers')
      .select('teacher_id')
      .eq('class_id', fromSchedule.class_id)
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      .single();

    const { data: toTeacher } = await supabase
      .from('class_teachers')
      .select('teacher_id')
      .eq('class_id', toSchedule.class_id)
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      .single();

    // 승인 요청 생성
    const { data: request, error } = await supabase
      .from('class_transfer_requests')
      .insert({
        tenant_id: profile.tenant_id,
        student_id: input.studentId,
        effective_date: input.effectiveDate,
        from_schedule_id: input.fromScheduleId,
        to_schedule_id: input.toScheduleId,
        from_class_id: fromSchedule.class_id,
        to_class_id: toSchedule.class_id,
        from_teacher_id: fromTeacher?.teacher_id || null,
        to_teacher_id: toTeacher?.teacher_id || null,
        scope: input.scope,
        group_key: input.scope === 'same_group' ? input.groupKey : null,
        requested_by: user.id,
        reason: input.reason || null,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { ok: false, message: '이미 동일한 이동 요청이 대기 중입니다' };
      }
      throw error;
    }

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/timetable');

    return { ok: true, data: { id: request.id } };
  } catch (e: any) {
    console.error('[createTransferRequest] error:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// ============================================================================
// 대기 중인 요청 목록 조회 (원장 대시보드용)
// ============================================================================

export async function getPendingTransferRequests(): Promise<TransferRequest[]> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') return [];

    const { data: requests, error } = await supabase
      .from('class_transfer_requests')
      .select(`
        id,
        student_id,
        effective_date,
        from_schedule_id,
        to_schedule_id,
        from_class_id,
        to_class_id,
        from_teacher_id,
        to_teacher_id,
        scope,
        status,
        requested_by,
        created_at,
        review_note,
        students (name, display_code),
        from_class:classes!class_transfer_requests_from_class_id_fkey (name, color),
        to_class:classes!class_transfer_requests_to_class_id_fkey (name, color),
        from_schedule:class_schedules!class_transfer_requests_from_schedule_id_fkey (day_of_week, start_time),
        to_schedule:class_schedules!class_transfer_requests_to_schedule_id_fkey (day_of_week, start_time),
        from_teacher:profiles!class_transfer_requests_from_teacher_id_fkey (display_name),
        to_teacher:profiles!class_transfer_requests_to_teacher_id_fkey (display_name),
        requester:profiles!class_transfer_requests_requested_by_fkey (display_name)
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (requests || []).map(r => {
      const student = r.students as any;
      const fromClass = r.from_class as any;
      const toClass = r.to_class as any;
      const fromSchedule = r.from_schedule as any;
      const toSchedule = r.to_schedule as any;
      const fromTeacher = r.from_teacher as any;
      const toTeacher = r.to_teacher as any;
      const requester = r.requester as any;

      return {
        id: r.id,
        studentId: r.student_id,
        studentName: student?.name || '알 수 없음',
        studentCode: student?.display_code || '',
        effectiveDate: r.effective_date,
        fromClassName: fromClass?.name || '알 수 없음',
        fromClassColor: fromClass?.color,
        fromTeacherName: fromTeacher?.display_name || '미지정',
        toClassName: toClass?.name || '알 수 없음',
        toClassColor: toClass?.color,
        toTeacherName: toTeacher?.display_name || '미지정',
        fromDayOfWeek: fromSchedule?.day_of_week ?? 0,
        fromStartTime: fromSchedule?.start_time?.slice(0, 5) || '',
        toDayOfWeek: toSchedule?.day_of_week ?? 0,
        toStartTime: toSchedule?.start_time?.slice(0, 5) || '',
        scope: r.scope as 'this_day' | 'same_group',
        status: r.status as 'pending',
        requestedByName: requester?.display_name || '알 수 없음',
        createdAt: r.created_at,
        reviewNote: r.review_note,
      };
    });
  } catch (e) {
    console.error('[getPendingTransferRequests] error:', e);
    return [];
  }
}

// ============================================================================
// 승인 처리 (원장)
// ============================================================================

export async function approveTransferRequest(
  requestId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: '로그인이 필요합니다' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return { ok: false, message: '원장만 승인할 수 있습니다' };
    }

    // 요청 정보 조회
    const { data: request } = await supabase
      .from('class_transfer_requests')
      .select('*')
      .eq('id', requestId)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .single();

    if (!request) {
      return { ok: false, message: '요청을 찾을 수 없거나 이미 처리되었습니다' };
    }

    const today = request.effective_date;

    // 트랜잭션처럼 처리 (순차 실행, 실패 시 롤백 어려움 - RPC 권장)
    // 1. 기존 배정 종료
    if (request.scope === 'this_day') {
      // 해당 스케줄만 종료
      const { data: assignment } = await supabase
        .from('enrollment_schedule_assignments')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('student_id', request.student_id)
        .eq('class_schedule_id', request.from_schedule_id)
        .is('end_date', null)
        .is('deleted_at', null)
        .single();

      if (assignment) {
        await supabase
          .from('enrollment_schedule_assignments')
          .update({ end_date: today, updated_at: new Date().toISOString() })
          .eq('id', assignment.id);
      }

      // 새 배정 생성
      await supabase
        .from('enrollment_schedule_assignments')
        .insert({
          tenant_id: profile.tenant_id,
          student_id: request.student_id,
          class_schedule_id: request.to_schedule_id,
          start_date: today,
          created_by: user.id,
        });

    } else if (request.scope === 'same_group' && request.group_key) {
      // 같은 group_key의 모든 배정 이동
      const { data: groupAssignments } = await supabase
        .from('enrollment_schedule_assignments')
        .select('id, class_schedule_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('student_id', request.student_id)
        .eq('group_key', request.group_key)
        .is('end_date', null)
        .is('deleted_at', null);

      // 대상 반의 스케줄 조회 (같은 시간대)
      const { data: toSchedule } = await supabase
        .from('class_schedules')
        .select('start_time, end_time')
        .eq('id', request.to_schedule_id)
        .single();

      const { data: targetSchedules } = await supabase
        .from('class_schedules')
        .select('id, day_of_week')
        .eq('tenant_id', profile.tenant_id)
        .eq('class_id', request.to_class_id)
        .eq('start_time', toSchedule?.start_time)
        .eq('end_time', toSchedule?.end_time)
        .eq('is_active', true)
        .is('deleted_at', null);

      const targetByDay: Record<number, string> = {};
      for (const ts of targetSchedules || []) {
        targetByDay[ts.day_of_week] = ts.id;
      }

      // 각 배정 이동
      for (const ga of groupAssignments || []) {
        const { data: fromSched } = await supabase
          .from('class_schedules')
          .select('day_of_week')
          .eq('id', ga.class_schedule_id)
          .single();

        if (fromSched && targetByDay[fromSched.day_of_week]) {
          // 종료
          await supabase
            .from('enrollment_schedule_assignments')
            .update({ end_date: today, updated_at: new Date().toISOString() })
            .eq('id', ga.id);

          // 새 배정
          await supabase
            .from('enrollment_schedule_assignments')
            .insert({
              tenant_id: profile.tenant_id,
              student_id: request.student_id,
              class_schedule_id: targetByDay[fromSched.day_of_week],
              group_key: request.group_key,
              start_date: today,
              created_by: user.id,
            });
        }
      }
    }

    // 2. 요청 상태 업데이트
    await supabase
      .from('class_transfer_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/timetable');

    return { ok: true };
  } catch (e: any) {
    console.error('[approveTransferRequest] error:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// ============================================================================
// 거절 처리 (원장)
// ============================================================================

export async function rejectTransferRequest(
  requestId: string,
  reviewNote?: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: '로그인이 필요합니다' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'owner') {
      return { ok: false, message: '원장만 거절할 수 있습니다' };
    }

    const { error } = await supabase
      .from('class_transfer_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'pending');

    if (error) throw error;

    revalidatePath('/dashboard/admin');
    revalidatePath('/dashboard/timetable');

    return { ok: true };
  } catch (e: any) {
    console.error('[rejectTransferRequest] error:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// ============================================================================
// 요청 취소 (요청자 본인)
// ============================================================================

export async function cancelTransferRequest(
  requestId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, message: '로그인이 필요합니다' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { ok: false, message: '프로필을 찾을 수 없습니다' };
    }

    const { error } = await supabase
      .from('class_transfer_requests')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('tenant_id', profile.tenant_id)
      .eq('requested_by', user.id)
      .eq('status', 'pending');

    if (error) throw error;

    revalidatePath('/dashboard/timetable');

    return { ok: true };
  } catch (e: any) {
    console.error('[cancelTransferRequest] error:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}
