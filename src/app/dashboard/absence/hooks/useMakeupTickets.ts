'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  getMakeupTickets, 
  completeTicket, 
  reopenTicket, 
  scheduleTicket,
  cancelTicketWithReason,
  type MakeupTicket 
} from '../makeup.actions';
import { getTodayString, getDaysAgoString, getMonthStartString } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type { MakeupTicket } from '../makeup.actions';
export type DateFilter = 'today' | 'week' | 'month' | 'custom';
export type StatusFilter = 'pending' | 'completed' | 'cancelled' | 'all';

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
  const [customStartDate, setCustomStartDate] = useState(() => getMonthStartString());
  const [customEndDate, setCustomEndDate] = useState(() => getTodayString());

  // 날짜 범위 계산 (로컬 타임존 기준)
  const getDateRange = useCallback(() => {
    const today = getTodayString();
    let startDate: string;
    let endDate: string;

    switch (dateFilter) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'week':
        startDate = getDaysAgoString(6);
        endDate = today;
        break;
      case 'month':
        startDate = getMonthStartString();
        endDate = today;
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = getMonthStartString();
        endDate = today;
    }

    return { startDate, endDate };
  }, [dateFilter, customStartDate, customEndDate]);

  // 티켓 로드 (Server Action 사용)
  const loadTickets = useCallback(async () => {
    setIsLoading(true);

    const { startDate, endDate } = getDateRange();
    const result = await getMakeupTickets(startDate, endDate, statusFilter === 'all' ? 'all' : statusFilter);

    if (result.success) {
      setTickets(result.data || []);
    } else {
      toast.error(result.error || '보강 목록 로드 실패');
      setTickets([]);
    }

    setIsLoading(false);
  }, [getDateRange, statusFilter]);

  // 필터 변경 시 로드
  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // 완료 처리
  const handleComplete = useCallback(
    async (ticketId: string) => {
      const note = noteInputs[ticketId]?.trim() || '보강 완료';

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

  // 날짜 예약
  const handleSchedule = useCallback(
    async (ticketId: string, scheduledDate: string, scheduledTime?: string) => {
      setProcessingId(ticketId);
      const result = await scheduleTicket(ticketId, scheduledDate, scheduledTime);

      if (result.success) {
        toast.success('보강 날짜가 예약되었습니다');
        loadTickets();
      } else {
        toast.error(result.error || '예약 실패');
      }
      setProcessingId(null);
    },
    [loadTickets]
  );

  // 보강 안함 (사유 포함)
  const handleCancelWithReason = useCallback(
    async (ticketId: string, reason: string) => {
      if (!reason.trim()) {
        toast.error('사유를 입력해주세요');
        return;
      }

      setProcessingId(ticketId);
      const result = await cancelTicketWithReason(ticketId, reason.trim());

      if (result.success) {
        toast.success('보강 안함 처리되었습니다');
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
    handleSchedule,
    handleCancelWithReason,
    updateNoteInput,
    reload: loadTickets,
  };
}
