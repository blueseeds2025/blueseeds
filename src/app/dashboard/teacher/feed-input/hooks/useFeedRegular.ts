'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  ClassStudent,
  FeedOptionSet,
  ExamType,
  StudentCardData,
  SavedFeedData,
  TenantSettings,
  AttendanceStatus,
  AbsenceReason,
  CardStatus,
  SaveFeedPayload,
  ProgressEntry,
  Textbook,
} from '../types';
import {
  getFeedPageData,
  saveFeed,
  saveAllFeedsBulk,
} from '../actions/feed.actions';
import { generateIdempotencyKey, TOAST_MESSAGES } from '../constants';

// ============================================================================
// Props 타입 - 서버 초기 데이터 포함
// ============================================================================

interface UseFeedRegularProps {
  classId: string;
  date: string;
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];
  tenantSettings: TenantSettings;
  makeupTicketMap: Record<string, string>;
  setMakeupTicketMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  // 🆕 서버에서 받은 초기 데이터
  initialStudents: ClassStudent[];
  initialSavedFeeds: Record<string, SavedFeedData>;
  initialPreviousProgressMap: Record<string, string>;
  initialPreviousProgressEntriesMap: Record<string, ProgressEntry[]>;
  serverClassId: string;
  serverDate: string;
}

export function useFeedRegular({
  classId,
  date,
  optionSets,
  examTypes,
  textbooks,
  tenantSettings,
  makeupTicketMap,
  setMakeupTicketMap,
  initialStudents,
  initialSavedFeeds,
  initialPreviousProgressMap,
  initialPreviousProgressEntriesMap,
  serverClassId,
  serverDate,
}: UseFeedRegularProps) {
  // 🆕 초기화 완료 플래그 (서버 데이터로 한 번만 초기화)
  const isInitialized = useRef(false);
  
  // 학생 및 피드 데이터
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [cardDataMap, setCardDataMap] = useState<Record<string, StudentCardData>>({});
  
  // 로딩/저장 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  // Dirty 체크
  const hasDirtyCards = Object.values(cardDataMap).some(c => c.isDirty);
  const dirtyCount = Object.values(cardDataMap).filter(c => c.isDirty || c.status === 'dirty').length;

  // 이전 진도 저장 (교재별)
  const [previousProgressEntriesMap, setPreviousProgressEntriesMap] = useState<Record<string, ProgressEntry[]>>({});

  // 카드 데이터 생성 헬퍼
  function createCardData(
    student: ClassStudent,
    saved: SavedFeedData | undefined,
    previousProgress: string | undefined,
    previousProgressEntries: ProgressEntry[] = []
  ): StudentCardData {
    const feedValues: Record<string, string | null> = {};
    optionSets.forEach(set => {
      const savedValue = saved?.feedValues?.find(v => v.setId === set.id);
      feedValues[set.id] = savedValue?.optionId || null;
    });
    
    const examScores: Record<string, number | null> = {};
    examTypes.forEach(exam => {
      const savedScore = saved?.examScores?.find(e => e.setId === exam.id);
      examScores[exam.id] = savedScore?.score ?? null;
    });
    
    const memoValues: Record<string, string> = saved?.memoValues || { 'default': '' };
    const hasSaved = !!saved;
    const status: CardStatus = hasSaved ? 'saved' : 'empty';
    
    return {
      studentId: student.id,
      studentName: student.name,
      isMakeup: student.is_makeup || false,
      attendanceStatus: saved?.attendanceStatus || 'present',
      absenceReason: saved?.absenceReason as AbsenceReason | undefined,
      absenceReasonDetail: saved?.absenceReasonDetail,
      notifyParent: saved?.notifyParent || false,
      progressText: saved?.progressText,
      previousProgress,
      progressEntries: saved?.progressEntries || [],
      feedValues,
      examScores,
      memoValues,
      materials: [],
      status,
      isDirty: false,
      savedData: saved,
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
  
  // 저장 전 진도 유효성 검사
  function validateProgressBeforeSave(data: StudentCardData): boolean {
    if (!tenantSettings.progress_enabled || textbooks.length === 0) {
      return true;
    }
    
    const entries = data.progressEntries ?? [];
    
    if (entries.length === 0) {
      return false;
    }
    
    const hasEmptyProgress = entries.some(e => !e.endPageText?.trim());
    if (hasEmptyProgress) {
      return false;
    }
    
    return true;
  }

  // ============================================================================
  // 🆕 서버 초기 데이터로 초기화 OR 반/날짜 변경 시 fetch
  // ============================================================================
  
  useEffect(() => {
    // classId 없으면 대기
    if (!classId) return;
    
    async function loadData() {
      setIsLoading(true);
      setMakeupTicketMap({});
      
      // 🆕 서버에서 가져온 반/날짜와 현재 선택된 반/날짜가 같으면 초기 데이터 사용
      const useInitialData = !isInitialized.current && 
        classId === serverClassId && 
        date === serverDate;
      
      try {
        let loadedStudents: ClassStudent[];
        let savedFeeds: Record<string, SavedFeedData>;
        let previousProgressMap: Record<string, string>;
        let prevEntriesMap: Record<string, ProgressEntry[]>;
        
        if (useInitialData) {
          // ✅ 서버 초기 데이터 사용 (fetch 없음!)
          loadedStudents = initialStudents;
          savedFeeds = initialSavedFeeds as Record<string, SavedFeedData>;
          previousProgressMap = initialPreviousProgressMap;
          prevEntriesMap = initialPreviousProgressEntriesMap;
          isInitialized.current = true;
        } else {
          // 🔄 반/날짜가 바뀌었으면 서버에서 새로 fetch
          const result = await getFeedPageData(
            classId,
            date,
            tenantSettings.progress_enabled,
            textbooks.length > 0
          );
          
          if (!result.success || !result.data) {
            toast.error('데이터를 불러오는데 실패했습니다');
            return;
          }
          
          loadedStudents = result.data.students;
          savedFeeds = result.data.savedFeeds;
          previousProgressMap = result.data.previousProgressMap;
          prevEntriesMap = result.data.previousProgressEntriesMap;
        }
        
        setStudents(loadedStudents);
        setPreviousProgressEntriesMap(prevEntriesMap);
        
        const newCardDataMap: Record<string, StudentCardData> = {};
        
        for (const student of loadedStudents) {
          const saved = savedFeeds[student.id];
          const previousProgress = previousProgressMap[student.id];
          const prevEntries = prevEntriesMap[student.id] || [];
          newCardDataMap[student.id] = createCardData(student, saved, previousProgress, prevEntries);
        }
        
        setCardDataMap(newCardDataMap);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [classId, date]); // 🆕 settingsLoaded 제거, classId/date만 의존

  // 페이지 이탈 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirtyCards) {
        e.preventDefault();
        e.returnValue = TOAST_MESSAGES.UNSAVED_WARNING;
        return TOAST_MESSAGES.UNSAVED_WARNING;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirtyCards]);

  // 카드 업데이트 헬퍼
  const updateCardData = useCallback((
    studentId: string,
    updates: Partial<StudentCardData>
  ) => {
    setCardDataMap(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      
      const updated = { ...current, ...updates, isDirty: true };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [studentId]: updated };
    });
  }, [optionSets, tenantSettings]);

  // 출결 변경
  const handleAttendanceChange = useCallback((
    studentId: string,
    status: AttendanceStatus,
    reason?: AbsenceReason,
    detail?: string
  ) => {
    const makeupDefault = status === 'absent' && reason 
      ? tenantSettings.makeup_defaults?.[reason] ?? true
      : false;
    
    updateCardData(studentId, {
      attendanceStatus: status,
      absenceReason: status === 'absent' ? reason : undefined,
      absenceReasonDetail: status === 'absent' && reason === '기타' ? detail : undefined,
      notifyParent: status === 'absent' && (reason === '무단'),
      needsMakeup: status === 'absent' ? makeupDefault : false,
    });
  }, [updateCardData, tenantSettings.makeup_defaults]);

  // 학부모 알림 변경
  const handleNotifyParentChange = useCallback((studentId: string, notify: boolean) => {
    updateCardData(studentId, { notifyParent: notify });
  }, [updateCardData]);

  // 보강 필요 변경
  const handleNeedsMakeupChange = useCallback((studentId: string, needsMakeup: boolean) => {
    updateCardData(studentId, { needsMakeup });
  }, [updateCardData]);

  // 진도 변경 (텍스트)
  const handleProgressChange = useCallback((studentId: string, text: string) => {
    updateCardData(studentId, { progressText: text });
  }, [updateCardData]);

  // 진도 변경 (교재별)
  const handleProgressEntriesChange = useCallback((studentId: string, entries: ProgressEntry[]) => {
    updateCardData(studentId, { progressEntries: entries });
  }, [updateCardData]);

  // 진도 반 전체 적용
  const handleApplyProgressToAll = useCallback((sourceStudentId: string) => {
    const sourceCard = cardDataMap[sourceStudentId];
    if (!sourceCard) return;
    
    const sourceEntries = sourceCard.progressEntries || [];
    if (sourceEntries.length === 0) {
      toast.error('적용할 진도가 없습니다');
      return;
    }
    
    setCardDataMap(prev => {
      const updated = { ...prev };
      for (const studentId of Object.keys(updated)) {
        if (studentId === sourceStudentId) continue;
        if (updated[studentId].attendanceStatus === 'absent') continue;
        
        updated[studentId] = {
          ...updated[studentId],
          progressEntries: [...sourceEntries],
          isDirty: true,
        };
        updated[studentId].status = calculateCardStatus(updated[studentId]);
      }
      return updated;
    });
    
    toast.success('진도가 반 전체에 적용되었습니다');
  }, [cardDataMap]);

  // 메모 변경
  const handleMemoChange = useCallback((studentId: string, key: string, value: string) => {
    setCardDataMap(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      
      const updated = {
        ...current,
        memoValues: { ...current.memoValues, [key]: value },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [studentId]: updated };
    });
  }, []);

  // 피드 값 변경
  const handleFeedValueChange = useCallback((
    studentId: string,
    setId: string,
    optionId: string
  ) => {
    setCardDataMap(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      
      const updated = {
        ...current,
        feedValues: { ...current.feedValues, [setId]: optionId },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [studentId]: updated };
    });
  }, [optionSets]);

  // 시험 점수 변경
  const handleExamScoreChange = useCallback((
    studentId: string,
    setId: string,
    score: number | null
  ) => {
    setCardDataMap(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      
      const updated = {
        ...current,
        examScores: { ...current.examScores, [setId]: score },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [studentId]: updated };
    });
  }, [optionSets]);

  // 단일 저장
  const handleSave = useCallback(async (studentId: string) => {
    const cardData = cardDataMap[studentId];
    if (!cardData) return;
    
    if (cardData.attendanceStatus !== 'absent' && !validateProgressBeforeSave(cardData)) {
      toast.error('진도를 입력해주세요');
      return;
    }
    
    if (cardData.status === 'error') {
      toast.error(TOAST_MESSAGES.REQUIRED_MISSING);
      return;
    }
    
    setSavingStudentId(studentId);
    
    const ticketId = makeupTicketMap[studentId];
    const isMakeupSession = !!ticketId;
    
    try {
      const examScores = Object.entries(cardData.examScores)
        .filter(([_, score]) => score !== null && score !== undefined)
        .map(([setId, score]) => ({ setId, score: score! }));
      
      const payload: SaveFeedPayload = {
        studentId,
        classId,
        feedDate: date,
        attendanceStatus: cardData.attendanceStatus,
        absenceReason: cardData.absenceReason,
        absenceReasonDetail: cardData.absenceReasonDetail,
        notifyParent: cardData.notifyParent,
        isMakeup: isMakeupSession,
        needsMakeup: cardData.needsMakeup,
        sessionType: isMakeupSession ? 'makeup' : 'regular',
        makeupTicketId: ticketId,
        progressText: cardData.attendanceStatus !== 'absent' ? cardData.progressText : undefined,
        progressEntries: cardData.attendanceStatus !== 'absent' ? cardData.progressEntries : [],
        memoValues: cardData.memoValues,
        feedValues: cardData.attendanceStatus !== 'absent'
          ? Object.entries(cardData.feedValues)
              .filter(([_, optionId]) => optionId)
              .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
          : [],
        examScores: cardData.attendanceStatus !== 'absent' ? examScores : [],
        idempotencyKey: generateIdempotencyKey(),
      };
      
      const result = await saveFeed(payload);
      
      if (result.success) {
        toast.success(TOAST_MESSAGES.SAVE_SUCCESS);
        
        setCardDataMap(prev => ({
          ...prev,
          [studentId]: {
            ...prev[studentId],
            status: 'saved',
            isDirty: false,
            savedData: {
              id: result.feedId!,
              attendanceStatus: cardData.attendanceStatus,
              absenceReason: cardData.absenceReason,
              absenceReasonDetail: cardData.absenceReasonDetail,
              notifyParent: cardData.notifyParent,
              isMakeup: isMakeupSession,
              progressText: cardData.progressText,
              memoValues: cardData.memoValues,
              feedValues: Object.entries(cardData.feedValues)
                .filter(([_, optionId]) => optionId)
                .map(([setId, optionId]) => ({ setId, optionId: optionId! })),
              examScores,
            },
          },
        }));
        
        if (cardData.isMakeup && makeupTicketMap[studentId]) {
          setMakeupTicketMap(prev => {
            const { [studentId]: _, ...rest } = prev;
            return rest;
          });
        }
      } else {
        toast.error(result.error || TOAST_MESSAGES.SAVE_ERROR);
      }
    } finally {
      setSavingStudentId(null);
    }
  }, [cardDataMap, classId, date, makeupTicketMap, setMakeupTicketMap]);

  // 전체 저장
  const handleSaveAll = useCallback(async () => {
    const dirtyCards = Object.values(cardDataMap).filter(c => c.isDirty || c.status === 'dirty');
    
    if (dirtyCards.length === 0) {
      toast.info('저장할 변경사항이 없습니다');
      return;
    }
    
    const progressErrorCards = dirtyCards.filter(c => 
      c.attendanceStatus !== 'absent' && !validateProgressBeforeSave(c)
    );
    if (progressErrorCards.length > 0) {
      toast.error(`${progressErrorCards.length}명의 진도가 입력되지 않았습니다`);
      return;
    }
    
    const errorCards = dirtyCards.filter(c => c.status === 'error');
    if (errorCards.length > 0) {
      toast.error(`${errorCards.length}명의 필수 항목이 누락되었습니다`);
      return;
    }
    
    setIsSaving(true);
    
    try {
      const payloads: SaveFeedPayload[] = dirtyCards.map(cardData => {
        const ticketId = makeupTicketMap[cardData.studentId];
        const isMakeupSession = !!ticketId;
        
        const examScores = Object.entries(cardData.examScores)
          .filter(([_, score]) => score !== null && score !== undefined)
          .map(([setId, score]) => ({ setId, score: score! }));
        
        return {
          studentId: cardData.studentId,
          classId,
          feedDate: date,
          attendanceStatus: cardData.attendanceStatus,
          absenceReason: cardData.absenceReason,
          absenceReasonDetail: cardData.absenceReasonDetail,
          notifyParent: cardData.notifyParent,
          isMakeup: isMakeupSession,
          needsMakeup: cardData.needsMakeup,
          sessionType: isMakeupSession ? 'makeup' : 'regular',
          makeupTicketId: ticketId,
          progressText: cardData.attendanceStatus !== 'absent' ? cardData.progressText : undefined,
          progressEntries: cardData.attendanceStatus !== 'absent' ? cardData.progressEntries : [],
          memoValues: cardData.memoValues,
          feedValues: cardData.attendanceStatus !== 'absent'
            ? Object.entries(cardData.feedValues)
                .filter(([_, optionId]) => optionId)
                .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
            : [],
          examScores: cardData.attendanceStatus !== 'absent' ? examScores : [],
          idempotencyKey: generateIdempotencyKey(),
        };
      });
      
      const result = await saveAllFeedsBulk(payloads);
      
      const successCount = result.totalSaved;
      const failCount = result.totalFailed;
      
      if (failCount === 0) {
        toast.success(TOAST_MESSAGES.SAVE_ALL_SUCCESS(successCount));
      } else {
        toast.warning(TOAST_MESSAGES.SAVE_ALL_PARTIAL(successCount, failCount));
      }
      
      setCardDataMap(prev => {
        const updated = { ...prev };
        result.results.forEach(r => {
          if (r.success && updated[r.studentId]) {
            updated[r.studentId] = {
              ...updated[r.studentId],
              status: 'saved',
              isDirty: false,
            };
          }
        });
        return updated;
      });
      
      const successStudentIds = result.results.filter(r => r.success).map(r => r.studentId);
      setMakeupTicketMap(prev => {
        const updated = { ...prev };
        successStudentIds.forEach(id => {
          if (updated[id]) delete updated[id];
        });
        return updated;
      });
    } finally {
      setIsSaving(false);
    }
  }, [cardDataMap, classId, date, makeupTicketMap, setMakeupTicketMap]);

  return {
    // 학생 및 피드 데이터
    students,
    setStudents,
    cardDataMap,
    setCardDataMap,
    previousProgressEntriesMap,
    
    // 핸들러
    handleAttendanceChange,
    handleNotifyParentChange,
    handleNeedsMakeupChange,
    handleProgressChange,
    handleProgressEntriesChange,
    handleApplyProgressToAll,
    handleMemoChange,
    handleFeedValueChange,
    handleExamScoreChange,
    handleSave,
    handleSaveAll,
    
    // 상태
    isLoading,
    isSaving,
    savingStudentId,
    hasDirtyCards,
    dirtyCount,
  };
}
