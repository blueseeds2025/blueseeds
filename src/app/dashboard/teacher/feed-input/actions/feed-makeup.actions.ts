'use server';

import { createClient } from '@/lib/supabase/server';
import { ClassStudent } from '../types';

// ============================================================================
// 보강 티켓 타입
// ============================================================================

export interface PendingMakeupTicket {
  id: string;
  studentId: string;
  studentName: string;
  displayCode: string;
  className: string;
  classId: string;
  absenceDate: string;
  absenceReason: string | null;
}

// ============================================================================
// 보강 티켓 헬퍼 (내부용)
// ============================================================================

interface MakeupTicketParams {
  feedId: string;
  tenantId: string;
  studentId: string;
  classId: string;
  feedDate: string;
  absenceReason?: string;
  needsMakeup: boolean;
  attendanceStatus: string;
}

export async function handleMakeupTicket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: MakeupTicketParams
) {
  const { feedId, tenantId, studentId, classId, feedDate, absenceReason, needsMakeup, attendanceStatus } = params;
  
  // 기존 티켓 확인
  const { data: existingTicket } = await supabase
    .from('makeup_tickets')
    .select('id, status')
    .eq('feed_id', feedId)
    .single();
  
  // 결석 + 보강 필요 → 티켓 생성/유지
  if (attendanceStatus === 'absent' && needsMakeup) {
    if (!existingTicket) {
      // 새 티켓 생성
      await supabase
        .from('makeup_tickets')
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          class_id: classId,
          feed_id: feedId,
          absence_date: feedDate,
          absence_reason: absenceReason,
          status: 'pending',
        });
    } else if (existingTicket.status === 'cancelled') {
      // 취소된 티켓 다시 활성화
      await supabase
        .from('makeup_tickets')
        .update({ 
          status: 'pending',
          absence_reason: absenceReason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTicket.id);
    }
  } else {
    // 보강 불필요 → 기존 티켓 취소
    if (existingTicket && existingTicket.status === 'pending') {
      await supabase
        .from('makeup_tickets')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTicket.id);
    }
  }
}

// ============================================================================
// 보강 티켓 완료 처리 (내부용)
// ============================================================================

export async function completeMakeupTicket(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ticketId: string,
  makeupDate: string,
  makeupClassId: string
) {
  console.log('completeMakeupTicket:', { ticketId, makeupDate, makeupClassId });
  
  const { error } = await supabase
    .from('makeup_tickets')
    .update({
      status: 'completed',
      makeup_date: makeupDate,
      makeup_class_id: makeupClassId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);
  
  if (error) {
    console.error('completeMakeupTicket error:', error);
  }
}

// ============================================================================
// 보강 대기 목록 조회
// ============================================================================

export async function getPendingMakeupTickets(): Promise<{
  success: boolean;
  data?: PendingMakeupTicket[];
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
    
    const { data: tickets, error: ticketsError } = await supabase
      .from('makeup_tickets')
      .select('id, student_id, class_id, absence_date, absence_reason')
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'pending')
      .order('absence_date', { ascending: true });
    
    if (ticketsError) throw ticketsError;
    
    if (!tickets || tickets.length === 0) {
      return { success: true, data: [] };
    }
    
    // 학생 정보 조회
    const studentIds = [...new Set(tickets.map(t => t.student_id).filter((id): id is string => id !== null))];
    const { data: students } = await supabase
      .from('students')
      .select('id, name, display_code')
      .in('id', studentIds);
    
    const studentMap = new Map(
      (students || []).map(s => [s.id, { name: s.name, displayCode: s.display_code ?? '' }])
    );
    
    // 반 정보 조회
    const classIds = [...new Set(tickets.map(t => t.class_id).filter((id): id is string => id !== null))];
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .in('id', classIds);
    
    const classMap = new Map(
      (classes || []).map(c => [c.id, c.name])
    );
    
    // 결과 조합
    const result: PendingMakeupTicket[] = tickets
      .filter(ticket => ticket.student_id && ticket.class_id)
      .map(ticket => ({
        id: ticket.id,
        studentId: ticket.student_id!,
        studentName: studentMap.get(ticket.student_id!)?.name || '알 수 없음',
        displayCode: studentMap.get(ticket.student_id!)?.displayCode || '',
        className: classMap.get(ticket.class_id!) || '알 수 없음',
        classId: ticket.class_id!,
        absenceDate: ticket.absence_date,
        absenceReason: ticket.absence_reason,
      }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getPendingMakeupTickets error:', error);
    return { success: false, error: '보강 대기 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 보강생 검색 (현재 반에 없는 학생)
// ============================================================================

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
    
    // 현재 반에 이미 있는 학생 ID (tenant_id 필터 추가)
    const { data: currentMembers } = await supabase
      .from('class_members')
      .select('student_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null);
    
    const currentIds = (currentMembers || [])
      .map(m => m.student_id)
      .filter((id): id is string => id !== null);
    
    // 이름으로 검색 (현재 반 학생 제외)
    let searchQuery = supabase
      .from('students')
      .select('id, name, display_code')
      .eq('tenant_id', profile.tenant_id)
      .ilike('name', `%${query}%`)
      .is('deleted_at', null)
      .limit(10);
    
    // UUID 필터 수정: 따옴표 추가
    if (currentIds.length > 0) {
      const inList = currentIds.map(id => `"${id}"`).join(',');
      searchQuery = searchQuery.not('id', 'in', `(${inList})`);
    }
    
    const { data, error } = await searchQuery;
    
    if (error) throw error;
    
    const students: ClassStudent[] = (data || []).map(s => ({
      id: s.id,
      name: s.name,
      display_code: s.display_code ?? '',
      class_id: classId,
      is_makeup: true,
    }));
    
    return { success: true, data: students };
  } catch (error) {
    console.error('searchMakeupStudents error:', error);
    return { success: false, error: '검색 중 오류가 발생했습니다' };
  }
}