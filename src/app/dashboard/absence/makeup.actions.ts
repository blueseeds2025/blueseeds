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

export interface AbsentStudent {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  feedDate: string;
  absenceReason: string | null;
  needsMakeup: boolean;
  monthlyAbsenceCount: number;
}

export interface MakeupTicketListResponse {
  success: boolean;
  data?: MakeupTicket[];
  error?: string;
}

export interface AbsentsListResponse {
  success: boolean;
  data?: AbsentStudent[];
  error?: string;
}

export interface CompleteTicketResponse {
  success: boolean;
  error?: string;
}

// ============================================================================
// 결석자 조회 (Server Action)
// ============================================================================

export async function getAbsents(
  startDate: string,
  endDate: string
): Promise<AbsentsListResponse> {
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

    // 피드 조회
    let query = supabase
      .from('student_feeds')
      .select(`
        id,
        student_id,
        class_id,
        feed_date,
        absence_reason,
        needs_makeup
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('attendance_status', 'absent')
      .gte('feed_date', startDate)
      .lte('feed_date', endDate)
      .order('feed_date', { ascending: false });

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

    const { data: feeds, error } = await query;
    
    if (error) throw error;
    if (!feeds || feeds.length === 0) {
      return { success: true, data: [] };
    }

    // 학생, 반 정보 별도 조회 (병렬)
    const studentIds = [...new Set(feeds.map(f => f.student_id))];
    const classIds = [...new Set(feeds.map(f => f.class_id))];
    
    // 이번달 결석 횟수도 함께 조회
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [studentsRes, classesRes, monthlyAbsencesRes] = await Promise.all([
      studentIds.length > 0 
        ? supabase.from('students').select('id, name').in('id', studentIds)
        : { data: [] },
      classIds.length > 0
        ? supabase.from('classes').select('id, name').in('id', classIds)
        : { data: [] },
      studentIds.length > 0
        ? supabase
            .from('student_feeds')
            .select('student_id')
            .eq('tenant_id', profile.tenant_id)
            .eq('attendance_status', 'absent')
            .in('student_id', studentIds)
            .gte('feed_date', monthStart)
            .lte('feed_date', monthEnd)
        : { data: [] },
    ]);

    const studentMap = new Map(studentsRes.data?.map(s => [s.id, s.name]) || []);
    const classMap = new Map(classesRes.data?.map(c => [c.id, c.name]) || []);

    // 학생별 결석 횟수 계산
    const absenceCountMap = new Map<string, number>();
    monthlyAbsencesRes.data?.forEach(item => {
      const count = absenceCountMap.get(item.student_id) || 0;
      absenceCountMap.set(item.student_id, count + 1);
    });

    const result: AbsentStudent[] = feeds.map(f => ({
      id: f.id,
      studentId: f.student_id,
      studentName: studentMap.get(f.student_id) || '알 수 없음',
      className: classMap.get(f.class_id) || '알 수 없음',
      feedDate: f.feed_date,
      absenceReason: f.absence_reason,
      needsMakeup: f.needs_makeup || false,
      monthlyAbsenceCount: absenceCountMap.get(f.student_id) || 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('getAbsents error:', error);
    return { success: false, error: '결석자 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 보강 티켓 조회 (Embedding 최적화)
// ============================================================================

export async function getMakeupTickets(
  startDate?: string,
  endDate?: string,
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
    
    // 티켓 조회
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
    
    // 날짜 필터
    if (startDate) {
      query = query.gte('absence_date', startDate);
    }
    if (endDate) {
      query = query.lte('absence_date', endDate);
    }
    
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
    if (!tickets || tickets.length === 0) {
      return { success: true, data: [] };
    }
    
    // 학생, 반 정보 별도 조회 (병렬)
    const studentIds = [...new Set(tickets.map(t => t.student_id))];
    const classIds = [...new Set(tickets.map(t => t.class_id))];
    
    const [studentsRes, classesRes] = await Promise.all([
      studentIds.length > 0 
        ? supabase.from('students').select('id, name').in('id', studentIds)
        : { data: [] },
      classIds.length > 0
        ? supabase.from('classes').select('id, name').in('id', classIds)
        : { data: [] },
    ]);
    
    const studentMap = new Map(studentsRes.data?.map(s => [s.id, s.name]) || []);
    const classMap = new Map(classesRes.data?.map(c => [c.id, c.name]) || []);
    
    const result: MakeupTicket[] = tickets.map(t => ({
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
createdAt: t.created_at || '',    }));
    
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
    
    revalidatePath('/dashboard/absence');
    
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
    
    revalidatePath('/dashboard/absence');
    
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
    
    revalidatePath('/dashboard/absence');
    
    return { success: true };
  } catch (error) {
    console.error('reopenTicket error:', error);
    return { success: false, error: '되돌리기에 실패했습니다' };
  }
}