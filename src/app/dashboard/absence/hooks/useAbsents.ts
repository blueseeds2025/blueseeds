'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getAbsents, type AbsentStudent } from '../makeup.actions';
import { getTodayString, getDaysAgoString, getMonthStartString } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type { AbsentStudent } from '../makeup.actions';
export type DateFilter = 'today' | 'week' | 'month' | 'custom';

// ============================================================================
// Hook
// ============================================================================

export function useAbsents() {
  const [absents, setAbsents] = useState<AbsentStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(() => getTodayString());
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
        startDate = today;
        endDate = today;
    }

    return { startDate, endDate };
  }, [dateFilter, customStartDate, customEndDate]);

  // 결석자 로드 (Server Action 사용)
  const loadAbsents = useCallback(async () => {
    setIsLoading(true);

    const { startDate, endDate } = getDateRange();
    const result = await getAbsents(startDate, endDate);

    if (result.success) {
      setAbsents(result.data || []);
    } else {
      toast.error(result.error || '결석자 목록을 불러오는데 실패했습니다');
      setAbsents([]);
    }

    setIsLoading(false);
  }, [getDateRange]);

  // 필터 변경 시 로드
  useEffect(() => {
    loadAbsents();
  }, [loadAbsents]);

  return {
    // Data
    absents,
    isLoading,

    // Filters
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,

    // Actions
    reload: loadAbsents,
  };
}
