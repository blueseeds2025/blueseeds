'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

// ============================================================================
// Types
// ============================================================================

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

export type DateFilter = 'today' | 'week' | 'month' | 'custom';

// ============================================================================
// Hook
// ============================================================================

export function useAbsents() {
  const [absents, setAbsents] = useState<AbsentStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
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
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
    }

    return { startDate, endDate };
  }, [dateFilter, customStartDate, customEndDate]);

  // 결석자 로드
  const loadAbsents = useCallback(async () => {
    setIsLoading(true);

    const { startDate, endDate } = getDateRange();

    const { data: feeds, error } = await supabase
      .from('student_feeds')
      .select('id, student_id, class_id, feed_date, absence_reason, needs_makeup')
      .gte('feed_date', startDate)
      .lte('feed_date', endDate)
      .eq('attendance_status', 'absent')
      .order('feed_date', { ascending: false });

    if (error) {
      toast.error('결석자 목록을 불러오는데 실패했습니다');
      setIsLoading(false);
      return;
    }

    if (!feeds || feeds.length === 0) {
      setAbsents([]);
      setIsLoading(false);
      return;
    }

    // 학생, 반 정보 조회
    const studentIds = [...new Set(feeds.map((f) => f.student_id))];
    const classIds = [...new Set(feeds.map((f) => f.class_id))];

    // 이번달 시작일 계산
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const monthEnd = currentMonth.toISOString().split('T')[0];

    const [studentsRes, classesRes, monthlyAbsencesRes] = await Promise.all([
      supabase.from('students').select('id, name').in('id', studentIds),
      supabase.from('classes').select('id, name').in('id', classIds),
      // 이번달 결석 횟수 조회
      supabase
        .from('student_feeds')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('attendance_status', 'absent')
        .gte('feed_date', monthStart)
        .lte('feed_date', monthEnd),
    ]);

    const studentMap = new Map(studentsRes.data?.map((s) => [s.id, s.name]) || []);
    const classMap = new Map(classesRes.data?.map((c) => [c.id, c.name]) || []);

    // 학생별 이번달 결석 횟수 계산
    const absenceCountMap = new Map<string, number>();
    monthlyAbsencesRes.data?.forEach((item) => {
      const count = absenceCountMap.get(item.student_id) || 0;
      absenceCountMap.set(item.student_id, count + 1);
    });

    setAbsents(
      feeds.map((f) => ({
        id: f.id,
        studentId: f.student_id,
        studentName: studentMap.get(f.student_id) || '알 수 없음',
        className: classMap.get(f.class_id) || '알 수 없음',
        feedDate: f.feed_date,
        absenceReason: f.absence_reason,
        needsMakeup: f.needs_makeup || false,
        monthlyAbsenceCount: absenceCountMap.get(f.student_id) || 0,
      }))
    );

    setIsLoading(false);
  }, [supabase, getDateRange]);

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
