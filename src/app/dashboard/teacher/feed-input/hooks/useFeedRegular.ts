'use client';

import { useState, useEffect, useCallback } from 'react';
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
  getClassStudents,
  getSavedFeeds,
  getPreviousProgressBatch,
  getPreviousProgressEntriesBatch,
  saveFeed,
  saveAllFeedsBulk,
} from '../actions/feed.actions';
import { generateIdempotencyKey, TOAST_MESSAGES } from '../constants';

interface UseFeedRegularProps {
  classId: string;
  date: string;
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];
  tenantSettings: TenantSettings;
  settingsLoaded: boolean;  // 🆕 추가
  makeupTicketMap: Record<string, string>;
  setMakeupTicketMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useFeedRegular({
  classId,
  date,
  optionSets,
  examTypes,
  textbooks,
  tenantSettings,
  settingsLoaded,  // 🆕 추가
  makeupTicketMap,
  setMakeupTicketMap,
}: UseFeedRegularProps) {
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
      const savedValue = saved?.feedValues.find(v => v.setId === set.id);
      feedValues[set.id] = savedValue?.optionId || null;
    });
    
    // 🆕 시험 점수 초기화
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
      progressEntries: saved?.progressEntries || [],  // 🆕 저장된 진도 적용
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
    
    // 분업형(team)이 아니면 필수 체크 (담임형은 전부 필수)
    if (tenantSettings.operation_mode !== 'team') {
      for (const set of optionSets) {
        if (!data.feedValues[set.id]) {
          return 'error';
        }
      }
    }
    
    // 🆕 진도 필수 체크는 저장 시점에 별도로 수행 (validateBeforeSave)
    
    if (!data.isDirty && data.savedData) return 'saved';
    return 'dirty';
  }
  
  // 🆕 저장 전 진도 유효성 검사
  function validateProgressBeforeSave(data: StudentCardData): boolean {
    if (!tenantSettings.progress_enabled || textbooks.length === 0) {
      return true;  // 진도 기능 꺼져있으면 통과
    }
    
    const entries = data.progressEntries ?? [];
    
    // 교재가 최소 1개 선택되어야 함
    if (entries.length === 0) {
      return false;
    }
    
    // 선택된 교재 중 페이지 입력 안 된 게 있으면 실패
    const hasEmptyProgress = entries.some(e => !e.endPageText?.trim());
    if (hasEmptyProgress) {
      return false;
    }
    
    return true;
  }

  // 학생 및 피드 데이터 로드
  useEffect(() => {
    // 설정이 로드되지 않았거나 classId가 없으면 대기
    if (!classId || !settingsLoaded) return;
    
    async function loadStudentsAndFeeds() {
      setIsLoading(true);
      setMakeupTicketMap({});
      
      try {
        const [studentsResult, feedsResult] = await Promise.all([
          getClassStudents(classId, date),
          getSavedFeeds(classId, date),
        ]);
        
        if (!studentsResult.success || !studentsResult.data) {
          toast.error('학생 목록을 불러오는데 실패했습니다');
          return;
        }
        
        setStudents(studentsResult.data);
        const savedFeeds = feedsResult.data || {};
        
        let previousProgressMap: Record<string, string> = {};
        let prevProgressEntriesMap: Record<string, ProgressEntry[]> = {};
        
        if (tenantSettings.progress_enabled && studentsResult.data.length > 0) {
          const studentIds = studentsResult.data.map(s => s.id);
          
          // 기존 텍스트 진도 (하위호환)
          previousProgressMap = await getPreviousProgressBatch(studentIds, date);
          
          // 🆕 교재별 진도
          if (textbooks.length > 0) {
            prevProgressEntriesMap = await getPreviousProgressEntriesBatch(studentIds, date);
          }
        }
        
        setPreviousProgressEntriesMap(prevProgressEntriesMap);
        
        const newCardDataMap: Record<string, StudentCardData> = {};
        
        for (const student of studentsResult.data) {
          const saved = savedFeeds[student.id];
          const previousProgress = previousProgressMap[student.id];
          const prevEntries = prevProgressEntriesMap[student.id] || [];
          newCardDataMap[student.id] = createCardData(student, saved, previousProgress, prevEntries);
        }
        
        setCardDataMap(newCardDataMap);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadStudentsAndFeeds();
  }, [classId, date, settingsLoaded]); // 설정 로드 완료 후 한 번만 실행

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
  }, [optionSets]);

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

  // 진도 변경 (기존 텍스트)
  const handleProgressChange = useCallback((studentId: string, progress: string) => {
    updateCardData(studentId, { progressText: progress });
  }, [updateCardData]);

  // 🆕 진도 변경 (교재별)
  const handleProgressEntriesChange = useCallback((studentId: string, entries: ProgressEntry[]) => {
    updateCardData(studentId, { progressEntries: entries });
  }, [updateCardData]);

  // 🆕 진도 반 전체 적용 (그룹 수업용)
  const handleApplyProgressToAll = useCallback((sourceStudentId: string, entries: ProgressEntry[]) => {
    if (entries.length === 0) return;
    
    setCardDataMap(prev => {
      const updated = { ...prev };
      
      Object.keys(updated).forEach(studentId => {
        // 원본 학생은 건너뛰기
        if (studentId === sourceStudentId) return;
        
        const current = updated[studentId];
        if (!current) return;
        
        // 결석 학생은 건너뛰기
        if (current.attendanceStatus === 'absent') return;
        
        // 진도 복사 (deep copy)
        const copiedEntries = entries.map(e => ({ ...e }));
        
        updated[studentId] = {
          ...current,
          progressEntries: copiedEntries,
          isDirty: true,
          status: calculateCardStatus({ ...current, progressEntries: copiedEntries, isDirty: true }),
        };
      });
      
      return updated;
    });
    
    toast.success('모든 학생에게 진도가 적용되었습니다');
  }, []);

  // 메모 변경
  const handleMemoChange = useCallback((studentId: string, fieldId: string, value: string) => {
    setCardDataMap(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      
      const updated = {
        ...current,
        memoValues: { ...current.memoValues, [fieldId]: value },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [studentId]: updated };
    });
  }, [optionSets]);

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

  // 🆕 시험 점수 변경
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
    
    // 🆕 진도 검사 (저장 시점에)
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
      // 🆕 시험 점수 추출 (null이 아닌 것만)
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
        progressEntries: cardData.attendanceStatus !== 'absent' ? cardData.progressEntries : [],  // 🆕 추가
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
              examScores,  // 🆕 추가
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
    
    // 🆕 진도 검사 (출석인 카드만)
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
        
        // 🆕 시험 점수 추출
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
          progressEntries: cardData.attendanceStatus !== 'absent' ? cardData.progressEntries : [],  // 🆕 추가
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
    previousProgressEntriesMap,  // 🆕 추가
    
    // 핸들러
    handleAttendanceChange,
    handleNotifyParentChange,
    handleNeedsMakeupChange,
    handleProgressChange,
    handleProgressEntriesChange,  // 🆕 추가
    handleApplyProgressToAll,  // 🆕 진도 반 전체 적용
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