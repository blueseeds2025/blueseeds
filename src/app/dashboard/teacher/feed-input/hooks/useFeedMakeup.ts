'use client';

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  ClassStudent,
  FeedOptionSet,
  StudentCardData,
  TenantSettings,
  AttendanceStatus,
  CardStatus,
  SaveFeedPayload,
  SavedFeedData,
  AbsenceReason,
} from '../types';
import {
  getPendingMakeupTickets,
  searchMakeupStudents,
  saveFeed,
  PendingMakeupTicket,
} from '../actions/feed.actions';
import { scheduleTicket, cancelTicketWithReason } from '@/app/dashboard/absence/makeup.actions';
import { generateIdempotencyKey, TOAST_MESSAGES } from '../constants';

interface UseFeedMakeupProps {
  classId: string;
  date: string;
  optionSets: FeedOptionSet[];
  tenantSettings: TenantSettings;
}

export function useFeedMakeup({ classId, date, optionSets, tenantSettings }: UseFeedMakeupProps) {
  // 보강 대기 목록
  const [pendingMakeupTickets, setPendingMakeupTickets] = useState<PendingMakeupTicket[]>([]);
  const [isLoadingMakeupTickets, setIsLoadingMakeupTickets] = useState(false);
  const [makeupPanelOpen, setMakeupPanelOpen] = useState(false);
  const [makeupSearchQuery, setMakeupSearchQuery] = useState('');
  
  // 보강 전용 상태
  const [makeupCardDataMap, setMakeupCardDataMap] = useState<Record<string, StudentCardData>>({});
  const [makeupTicketMap, setMakeupTicketMap] = useState<Record<string, string>>({});
  
  // 기존 검색 (하위 호환)
  const [makeupSearch, setMakeupSearch] = useState('');
  const [makeupResults, setMakeupResults] = useState<ClassStudent[]>([]);
  const [isSearchingMakeup, setIsSearchingMakeup] = useState(false);
  
  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  
  // 티켓 처리 상태
  const [processingTicketId, setProcessingTicketId] = useState<string | null>(null);

  // 필터된 보강 대기 목록
  const filteredMakeupTickets = useMemo(() => {
    return makeupSearchQuery.length >= 1
      ? pendingMakeupTickets.filter(t => 
          t.studentName.includes(makeupSearchQuery) ||
          t.displayCode.includes(makeupSearchQuery)
        )
      : pendingMakeupTickets;
  }, [pendingMakeupTickets, makeupSearchQuery]);

  // 카드 데이터 생성 헬퍼
  function createMakeupCardData(
    student: ClassStudent,
    ticketId: string
  ): StudentCardData {
    const feedValues: Record<string, string | null> = {};
    optionSets.forEach(set => {
      feedValues[set.id] = null;
    });
    
    return {
      studentId: student.id,
      studentName: student.name,
      isMakeup: true,
      attendanceStatus: 'present',
      absenceReason: undefined,
      absenceReasonDetail: undefined,
      notifyParent: false,
      progressText: undefined,
      previousProgress: undefined,
      feedValues,
      memoValues: { 'default': '' },
      materials: [],
      status: 'empty',
      isDirty: false,
      savedData: undefined,
      makeupTicketId: ticketId,
    };
  }

  // 카드 상태 계산
  function calculateCardStatus(data: StudentCardData): CardStatus {
    if (data.attendanceStatus === 'absent') {
      if (!data.absenceReason) return 'error';
      if (data.absenceReason === '기타' && !data.absenceReasonDetail) return 'error';
      if (!data.isDirty && data.savedData) return 'saved';
      return 'dirty';
    }
    
    // 분업형(team)이 아니면 필수 체크 (담임형은 전부 필수)
    if (tenantSettings.operation_mode !== 'team') {
      for (const set of optionSets) {
        if (!data.feedValues[set.id]) {
          return 'error';
        }
      }
    }
    
    if (!data.isDirty && data.savedData) return 'saved';
    return 'dirty';
  }

  // 보강 대기 목록 조회
  const loadPendingMakeupTickets = useCallback(async () => {
    setIsLoadingMakeupTickets(true);
    try {
      const result = await getPendingMakeupTickets();
      if (result.success && result.data) {
        setPendingMakeupTickets(result.data);
      }
    } finally {
      setIsLoadingMakeupTickets(false);
    }
  }, []);

  // 보강 패널 열기
  const openMakeupPanel = useCallback(() => {
    setMakeupPanelOpen(true);
    loadPendingMakeupTickets();
  }, [loadPendingMakeupTickets]);

  // 보강 패널 닫기
  const closeMakeupPanel = useCallback(() => {
    setMakeupPanelOpen(false);
    setMakeupSearchQuery('');
    setMakeupCardDataMap({});
    setMakeupTicketMap({});
  }, []);

  // 보강생 추가 (티켓 기반)
  const addMakeupStudentFromTicket = useCallback((ticket: PendingMakeupTicket) => {
    if (makeupCardDataMap[ticket.id]) {
      toast.info(`${ticket.studentName}은(는) 이미 추가되었습니다`);
      return;
    }
    
    const student: ClassStudent = {
      id: ticket.studentId,
      name: ticket.studentName,
      display_code: ticket.displayCode,
      class_id: ticket.classId,
      is_makeup: true,
    };
    
    const newCardData = createMakeupCardData(student, ticket.id);
    
    setMakeupCardDataMap(prev => ({
      ...prev,
      [ticket.id]: newCardData,
    }));
    
    setMakeupTicketMap(prev => ({
      ...prev,
      [ticket.studentId]: ticket.id,
    }));
    
    toast.success(`${ticket.studentName} 보강생 추가됨`);
  }, [makeupCardDataMap, optionSets]);

  // 보강 날짜 예약
  const handleScheduleTicket = useCallback(async (
    ticketId: string, 
    scheduledDate: string, 
    scheduledTime?: string
  ) => {
    setProcessingTicketId(ticketId);
    
    const result = await scheduleTicket(ticketId, scheduledDate, scheduledTime);
    
    if (result.success) {
      toast.success('보강 날짜가 예약되었습니다');
      await loadPendingMakeupTickets();
    } else {
      toast.error(result.error || '예약에 실패했습니다');
    }
    
    setProcessingTicketId(null);
  }, [loadPendingMakeupTickets]);

  // 보강 안함 처리
  const handleCancelTicket = useCallback(async (ticketId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('사유를 입력해주세요');
      return;
    }
    
    setProcessingTicketId(ticketId);
    
    const result = await cancelTicketWithReason(ticketId, reason.trim());
    
    if (result.success) {
      toast.success('보강 안함 처리되었습니다');
      await loadPendingMakeupTickets();
    } else {
      toast.error(result.error || '처리에 실패했습니다');
    }
    
    setProcessingTicketId(null);
  }, [loadPendingMakeupTickets]);

  // 보강 카드 출결 변경
  const handleMakeupAttendanceChange = useCallback((
    ticketId: string, 
    status: AttendanceStatus, 
    reason?: string, 
    detail?: string
  ) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      const updated = {
        ...cardData,
        attendanceStatus: status,
        absenceReason: reason as AbsenceReason | undefined,
        absenceReasonDetail: detail,
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [ticketId]: updated };
    });
  }, [optionSets, tenantSettings]);

  // 보강 카드 진도 변경
  const handleMakeupProgressChange = useCallback((ticketId: string, progress: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      const updated = {
        ...cardData,
        progressText: progress,
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [ticketId]: updated };
    });
  }, [optionSets, tenantSettings]);

  // 보강 카드 메모 변경
  const handleMakeupMemoChange = useCallback((ticketId: string, memoId: string, value: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      const updated = {
        ...cardData,
        memoValues: {
          ...cardData.memoValues,
          [memoId]: value,
        },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [ticketId]: updated };
    });
  }, [optionSets, tenantSettings]);

  // 보강 카드 피드 값 변경
  const handleMakeupFeedValueChange = useCallback((ticketId: string, setId: string, optionId: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      const updated = {
        ...cardData,
        feedValues: {
          ...cardData.feedValues,
          [setId]: optionId,
        },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [ticketId]: updated };
    });
  }, [optionSets, tenantSettings]);

  // 보강 피드 저장 (단일)
  const handleMakeupSave = useCallback(async (ticketId: string) => {
    const cardData = makeupCardDataMap[ticketId];
    if (!cardData) return;
    
    if (cardData.status === 'error') {
      toast.error(TOAST_MESSAGES.REQUIRED_MISSING);
      return;
    }
    
    setSavingStudentId(ticketId);
    
    try {
      const payload: SaveFeedPayload = {
        studentId: cardData.studentId,
        classId: classId,
        feedDate: date,
        attendanceStatus: cardData.attendanceStatus,
        absenceReason: undefined,
        absenceReasonDetail: undefined,
        notifyParent: false,
        isMakeup: true,
        needsMakeup: false,
        sessionType: 'makeup',
        makeupTicketId: ticketId,
        progressText: cardData.progressText,
        memoValues: cardData.memoValues,
        feedValues: cardData.attendanceStatus !== 'absent'
          ? Object.entries(cardData.feedValues)
              .filter(([_, optionId]) => optionId)
              .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
          : [],
        idempotencyKey: generateIdempotencyKey(),
      };
      
      const result = await saveFeed(payload);
      
      if (result.success) {
        toast.success(TOAST_MESSAGES.SAVE_SUCCESS);
        setMakeupCardDataMap(prev => ({
          ...prev,
          [ticketId]: {
            ...prev[ticketId],
            status: 'saved' as CardStatus,
            isDirty: false,
          },
        }));
      } else {
        toast.error(result.error || TOAST_MESSAGES.SAVE_ERROR);
      }
    } catch (error) {
      console.error('Makeup save error:', error);
      toast.error(TOAST_MESSAGES.SAVE_ERROR);
    } finally {
      setSavingStudentId(null);
    }
  }, [makeupCardDataMap, classId, date]);

  // 보강 피드 전체 저장
  const handleMakeupSaveAll = useCallback(async () => {
    const dirtyCards = Object.entries(makeupCardDataMap).filter(
      ([_, card]) => card.isDirty || card.status === 'dirty'
    );
    
    if (dirtyCards.length === 0) {
      toast.info('저장할 변경사항이 없습니다');
      return;
    }
    
    // Premium 플랜이면 error 체크
    const errorCards = dirtyCards.filter(([_, card]) => card.status === 'error');
    if (errorCards.length > 0) {
      toast.error(`${errorCards.length}명의 필수 항목이 누락되었습니다`);
      return;
    }
    
    setIsSaving(true);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const [ticketId, cardData] of dirtyCards) {
      try {
        const payload: SaveFeedPayload = {
          studentId: cardData.studentId,
          classId: classId,
          feedDate: date,
          attendanceStatus: cardData.attendanceStatus,
          absenceReason: undefined,
          absenceReasonDetail: undefined,
          notifyParent: false,
          isMakeup: true,
          needsMakeup: false,
          sessionType: 'makeup',
          makeupTicketId: ticketId,
          progressText: cardData.progressText,
          memoValues: cardData.memoValues,
          feedValues: cardData.attendanceStatus !== 'absent'
            ? Object.entries(cardData.feedValues)
                .filter(([_, optionId]) => optionId)
                .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
            : [],
          idempotencyKey: generateIdempotencyKey(),
        };
        
        const result = await saveFeed(payload);
        
        if (result.success) {
          successCount++;
          setMakeupCardDataMap(prev => ({
            ...prev,
            [ticketId]: {
              ...prev[ticketId],
              status: 'saved' as CardStatus,
              isDirty: false,
            },
          }));
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }
    
    setIsSaving(false);
    
    if (failCount === 0) {
      toast.success(`${successCount}명 보강 저장 완료`);
    } else {
      toast.warning(`${successCount}명 저장, ${failCount}명 실패`);
    }
  }, [makeupCardDataMap, classId, date]);

  // 기존 보강생 검색 (하위 호환)
  const searchMakeup = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMakeupResults([]);
      return;
    }
    
    setIsSearchingMakeup(true);
    const result = await searchMakeupStudents(classId, query);
    if (result.success && result.data) {
      setMakeupResults(result.data);
    }
    setIsSearchingMakeup(false);
  }, [classId]);

  return {
    // 보강 대기 목록
    pendingMakeupTickets: filteredMakeupTickets,
    isLoadingMakeupTickets,
    makeupPanelOpen,
    makeupSearchQuery,
    setMakeupSearchQuery,
    openMakeupPanel,
    closeMakeupPanel,
    addMakeupStudentFromTicket,
    loadPendingMakeupTickets,
    
    // 티켓 직접 처리
    handleScheduleTicket,
    handleCancelTicket,
    processingTicketId,
    
    // 보강 전용 상태 및 핸들러
    makeupCardDataMap,
    makeupTicketMap,
    handleMakeupAttendanceChange,
    handleMakeupProgressChange,
    handleMakeupMemoChange,
    handleMakeupFeedValueChange,
    handleMakeupSave,
    handleMakeupSaveAll,
    makeupDirtyCount: Object.values(makeupCardDataMap).filter(
      c => c.isDirty || c.status === 'dirty'
    ).length,
    
    // 저장 상태
    isSaving,
    savingStudentId,
    
    // 기존 검색 (하위 호환)
    makeupSearch,
    setMakeupSearch,
    makeupResults,
    isSearchingMakeup,
    searchMakeup,
  };
}
