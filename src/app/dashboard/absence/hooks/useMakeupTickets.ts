'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';
import { completeTicket, reopenTicket } from '../makeup.actions';
import type { Database } from '@/lib/database.types';

// ============================================================================
// Types
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
  completionNote: string | null;
}

export type DateFilter = 'today' | 'week' | 'month' | 'custom';
export type StatusFilter = 'pending' | 'completed' | 'all';

// ============================================================================
// Hook
// ============================================================================

export function useMakeupTickets() {
  const [tickets, setTickets] = useState<MakeupTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // 날짜 범위 계산
  const getDateRange = useCallback(() => {
    const today = new Date();
    let startDate: string;
    let endDate: string;

    switch (dateFilter) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        startDate = weekAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString()
          .split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
          .toISOString()
          .split('T')[0];
        endDate = today.toISOString().split('T')[0];
    }

    return { startDate, endDate };
  }, [dateFilter, customStartDate, customEndDate]);

  // 티켓 로드
  const loadTickets = useCallback(async () => {
    setIsLoading(true);

    const { startDate, endDate } = getDateRange();

    // 상태 필터 쿼리 구성
    let query = supabase
      .from('makeup_tickets')
      .select('*')
      .gte('absence_date', startDate)
      .lte('absence_date', endDate)
      .order('absence_date', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data: ticketData, error } = await query;

    if (error) {
      toast.error('보강 목록 로드 실패');
      setIsLoading(false);
      return;
    }

    if (!ticketData || ticketData.length === 0) {
      setTickets([]);
      setIsLoading(false);
      return;
    }

    // 학생, 반 정보 조회
    const studentIds = [...new Set(ticketData.map((t) => t.student_id))];
    const classIds = [...new Set(ticketData.map((t) => t.class_id))];

    const [studentsRes, classesRes] = await Promise.all([
      supabase.from('students').select('id, name').in('id', studentIds),
      supabase.from('classes').select('id, name').in('id', classIds),
    ]);

    const studentMap = new Map(studentsRes.data?.map((s) => [s.id, s.name]) || []);
    const classMap = new Map(classesRes.data?.map((c) => [c.id, c.name]) || []);

    setTickets(
      ticketData.map((t) => ({
        id: t.id,
        studentId: t.student_id,
        studentName: studentMap.get(t.student_id) || '알 수 없음',
        classId: t.class_id,
        className: classMap.get(t.class_id) || '알 수 없음',
        absenceDate: t.absence_date,
        absenceReason: t.absence_reason,
        status: t.status as 'pending' | 'completed' | 'cancelled',
        completionNote: t.completion_note,
      }))
    );

    setIsLoading(false);
  }, [supabase, getDateRange, statusFilter]);

  // 필터 변경 시 로드
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // 완료 처리
  const handleComplete = useCallback(
    async (ticketId: string) => {
      const note = noteInputs[ticketId]?.trim();
      if (!note) {
        toast.error('처리 내용을 입력해주세요');
        return;
      }

      setProcessingId(ticketId);
      const result = await completeTicket(ticketId, note);

      if (result.success) {
        toast.success('완료 처리되었습니다');
        loadTickets();
        setNoteInputs((prev) => ({ ...prev, [ticketId]: '' }));
      } else {
        toast.error(result.error || '처리 실패');
      }
      setProcessingId(null);
    },
    [noteInputs, loadTickets]
  );

  // 되돌리기
  const handleReopen = useCallback(
    async (ticketId: string) => {
      setProcessingId(ticketId);
      const result = await reopenTicket(ticketId);

      if (result.success) {
        toast.success('대기 상태로 되돌렸습니다');
        loadTickets();
      } else {
        toast.error(result.error || '처리 실패');
      }
      setProcessingId(null);
    },
    [loadTickets]
  );

  // 노트 입력 업데이트
  const updateNoteInput = useCallback((ticketId: string, value: string) => {
    setNoteInputs((prev) => ({ ...prev, [ticketId]: value }));
  }, []);

  // 통계
  const stats = useMemo(() => {
    return {
      pending: tickets.filter((t) => t.status === 'pending').length,
      completed: tickets.filter((t) => t.status === 'completed').length,
      cancelled: tickets.filter((t) => t.status === 'cancelled').length,
    };
  }, [tickets]);

  return {
    // Data
    tickets,
    isLoading,
    processingId,
    noteInputs,
    stats,

    // Filters
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,

    // Actions
    handleComplete,
    handleReopen,
    updateNoteInput,
    reload: loadTickets,
  };
}
