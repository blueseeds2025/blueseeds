'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ClassStudent,
  FeedOptionSet,
  StudentCardData,
  SavedFeedData,
  TenantSettings,
  AttendanceStatus,
  AbsenceReason,
  CardStatus,
  SaveFeedPayload,
} from '../types';
import {
  getClassStudents,
  getSavedFeeds,
  getPreviousProgressBatch,
  saveFeed,
  saveAllFeeds,
} from '../actions/feed.actions';
import { generateIdempotencyKey, TOAST_MESSAGES } from '../constants';

interface UseFeedRegularProps {
  classId: string;
  date: string;
  optionSets: FeedOptionSet[];
  tenantSettings: TenantSettings;
  makeupTicketMap: Record<string, string>;
  setMakeupTicketMap: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function useFeedRegular({
  classId,
  date,
  optionSets,
  tenantSettings,
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

  // 카드 데이터 생성 헬퍼
  function createCardData(
    student: ClassStudent,
    saved: SavedFeedData | undefined,
    previousProgress: string | undefined
  ): StudentCardData {
    const feedValues: Record<string, string | null> = {};
    optionSets.forEach(set => {
      const savedValue = saved?.feedValues.find(v => v.setId === set.id);
      feedValues[set.id] = savedValue?.optionId || null;
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
      feedValues,
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
    
    for (const set of optionSets) {
      if (!data.feedValues[set.id]) {
        return 'error';
      }
    }
    
    if (!data.isDirty && data.savedData) return 'saved';
    return 'dirty';
  }

  // 학생 및 피드 데이터 로드
  useEffect(() => {
    if (!classId) return;
    
    async function loadStudentsAndFeeds() {
      setIsLoading(true);
      setMakeupTicketMap({});
      
      try {
        const [studentsResult, feedsResult] = await Promise.all([
          getClassStudents(classId),
          getSavedFeeds(classId, date),
        ]);
        
        if (!studentsResult.success || !studentsResult.data) {
          toast.error('학생 목록을 불러오는데 실패했습니다');
          return;
        }
        
        setStudents(studentsResult.data);
        const savedFeeds = feedsResult.data || {};
        
        let previousProgressMap: Record<string, string> = {};
        if (tenantSettings.progress_enabled && studentsResult.data.length > 0) {
          const studentIds = studentsResult.data.map(s => s.id);
          previousProgressMap = await getPreviousProgressBatch(studentIds, date);
        }
        
        const newCardDataMap: Record<string, StudentCardData> = {};
        
        for (const student of studentsResult.data) {
          const saved = savedFeeds[student.id];
          const previousProgress = previousProgressMap[student.id];
          newCardDataMap[student.id] = createCardData(student, saved, previousProgress);
        }
        
        setCardDataMap(newCardDataMap);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadStudentsAndFeeds();
  }, [classId, date, optionSets, tenantSettings.progress_enabled]);

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
      notifyParent: status === 'absent' && (reason === '무단' || reason === '지각'),
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

  // 진도 변경
  const handleProgressChange = useCallback((studentId: string, progress: string) => {
    updateCardData(studentId, { progressText: progress });
  }, [updateCardData]);

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

  // 단일 저장
  const handleSave = useCallback(async (studentId: string) => {
    const cardData = cardDataMap[studentId];
    if (!cardData) return;
    
    if (cardData.status === 'error') {
      toast.error(TOAST_MESSAGES.REQUIRED_MISSING);
      return;
    }
    
    setSavingStudentId(studentId);
    
    const ticketId = makeupTicketMap[studentId];
    const isMakeupSession = !!ticketId;
    
    try {
      const payload: SaveFeedPayload = {
        studentId,
        classId,
        feedDate: date,
        attendanceStatus: cardData.attendanceStatus,
        absenceReason: cardData.absenceReason,
        absenceReasonDetail: cardData.absenceReasonDetail,
        notifyParent: cardData.notifyParent,
        isMakeup: isMakeupSession,
        needsMakeup: cardData.needsMakeup ?? false,
        sessionType: isMakeupSession ? 'makeup' : 'regular',
        makeupTicketId: ticketId,
        progressText: cardData.attendanceStatus !== 'absent' ? cardData.progressText : undefined,
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
        
        return {
          studentId: cardData.studentId,
          classId,
          feedDate: date,
          attendanceStatus: cardData.attendanceStatus,
          absenceReason: cardData.absenceReason,
          absenceReasonDetail: cardData.absenceReasonDetail,
          notifyParent: cardData.notifyParent,
          isMakeup: isMakeupSession,
          needsMakeup: cardData.needsMakeup ?? false,
          sessionType: isMakeupSession ? 'makeup' : 'regular',
          makeupTicketId: ticketId,
          progressText: cardData.attendanceStatus !== 'absent' ? cardData.progressText : undefined,
          memoValues: cardData.memoValues,
          feedValues: cardData.attendanceStatus !== 'absent'
            ? Object.entries(cardData.feedValues)
                .filter(([_, optionId]) => optionId)
                .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
            : [],
          idempotencyKey: generateIdempotencyKey(),
        };
      });
      
      const result = await saveAllFeeds(payloads);
      
      const successCount = result.results.filter(r => r.success).length;
      const failCount = result.results.filter(r => !r.success).length;
      
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
    
    // 핸들러
    handleAttendanceChange,
    handleNotifyParentChange,
    handleNeedsMakeupChange,
    handleProgressChange,
    handleMemoChange,
    handleFeedValueChange,
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
