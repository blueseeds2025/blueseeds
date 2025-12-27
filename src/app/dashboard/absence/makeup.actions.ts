'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ============================================================================
// 타입 정의
// ============================================================================

export interface MakeupTicket {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  absenceDate: string;
  absenceReason: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: string | null;
  completedBy: string | null;
  completionNote: string | null;
  createdAt: string;
}

export interface MakeupTicketListResponse {
  success: boolean;
  data?: MakeupTicket[];
  error?: string;
}

export interface CompleteTicketResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// 조회
// ============================================================================

// 보강 티켓 목록 조회
export async function getMakeupTickets(
  status?: 'pending' | 'completed' | 'cancelled' | 'all'
): Promise<MakeupTicketListResponse> {
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
    
    // 쿼리 빌드
    let query = supabase
      .from('makeup_tickets')
      .select(`
        id,
        student_id,
        class_id,
        absence_date,
        absence_reason,
        status,
        completed_at,
        completed_by,
        completion_note,
        created_at
      `)
      .eq('tenant_id', profile.tenant_id)
      .order('absence_date', { ascending: false });
    
    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // 교사는 자기 반만
    if (profile.role === 'teacher') {
      const { data: teacherClasses } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', user.id);
      
      const classIds = teacherClasses?.map(c => c.class_id) || [];
      if (classIds.length > 0) {
        query = query.in('class_id', classIds);
      } else {
        return { success: true, data: [] };
      }
    }
    
    const { data: tickets, error } = await query;
    
    if (error) throw error;
    
    // 학생 정보 조회
    const studentIds = [...new Set(tickets?.map(t => t.student_id) || [])];
    const classIds = [...new Set(tickets?.map(t => t.class_id) || [])];
    
    const [studentsResult, classesResult] = await Promise.all([
      studentIds.length > 0 
        ? supabase.from('students').select('id, name').in('id', studentIds)
        : { data: [] },
      classIds.length > 0
        ? supabase.from('classes').select('id, name').in('id', classIds)
        : { data: [] },
    ]);
    
    const studentMap = new Map(studentsResult.data?.map(s => [s.id, s.name]) || []);
    const classMap = new Map(classesResult.data?.map(c => [c.id, c.name]) || []);
    
    const result: MakeupTicket[] = (tickets || []).map(t => ({
      id: t.id,
      studentId: t.student_id,
      studentName: studentMap.get(t.student_id) || '알 수 없음',
      classId: t.class_id,
      className: classMap.get(t.class_id) || '알 수 없음',
      absenceDate: t.absence_date,
      absenceReason: t.absence_reason,
      status: t.status as 'pending' | 'completed' | 'cancelled',
      completedAt: t.completed_at,
      completedBy: t.completed_by,
      completionNote: t.completion_note,
      createdAt: t.created_at,
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getMakeupTickets error:', error);
    return { success: false, error: '보강 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 처리
// ============================================================================

// 보강 완료 처리
export async function completeTicket(
  ticketId: string,
  note: string
): Promise<CompleteTicketResponse> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { error } = await supabase
      .from('makeup_tickets')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id,
        completion_note: note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);
    
    if (error) throw error;
    
    revalidatePath('/dashboard/teacher/makeup-manage');
    
    return { success: true };
  } catch (error) {
    console.error('completeTicket error:', error);
    return { success: false, error: '완료 처리에 실패했습니다' };
  }
}

// 보강 취소 (되돌리기)
export async function cancelTicket(ticketId: string): Promise<CompleteTicketResponse> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { error } = await supabase
      .from('makeup_tickets')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);
    
    if (error) throw error;
    
    revalidatePath('/dashboard/teacher/makeup-manage');
    
    return { success: true };
  } catch (error) {
    console.error('cancelTicket error:', error);
    return { success: false, error: '취소 처리에 실패했습니다' };
  }
}

// 대기 상태로 되돌리기
export async function reopenTicket(ticketId: string): Promise<CompleteTicketResponse> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { error } = await supabase
      .from('makeup_tickets')
      .update({
        status: 'pending',
        completed_at: null,
        completed_by: null,
        completion_note: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId);
    
    if (error) throw error;
    
    revalidatePath('/dashboard/teacher/makeup-manage');
    
    return { success: true };
  } catch (error) {
    console.error('reopenTicket error:', error);
    return { success: false, error: '되돌리기에 실패했습니다' };
  }
}