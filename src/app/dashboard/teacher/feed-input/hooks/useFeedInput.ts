'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClassInfo,
  ClassStudent,
  FeedOptionSet,
  StudentCardData,
  SavedFeedData,
  TenantSettings,
  BottomSheetState,
  AttendanceStatus,
  AbsenceReason,
  CardStatus,
  SaveFeedPayload,
} from '../types';
import {
  getTeacherClasses,
  getClassStudents,
  getFeedOptionSets,
  getSavedFeeds,
  getPreviousProgress,
  getTenantSettings,
  saveFeed,
  saveAllFeeds,
  searchMakeupStudents,
} from '../actions/feed.actions';
import { 
  formatDate, 
  generateIdempotencyKey,
  TOAST_MESSAGES 
} from '../constants';
import { toast } from 'sonner';

export function useFeedInput() {
  // 기본 상태
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  
  // 학생 및 피드 데이터
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [cardDataMap, setCardDataMap] = useState<Record<string, StudentCardData>>({});
  const [optionSets, setOptionSets] = useState<FeedOptionSet[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({
    progress_enabled: false,
    materials_enabled: false,
  });
  
  // 바텀시트 상태
  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>({
    isOpen: false,
    studentId: null,
    setId: null,
    setName: null,
    options: [],
    currentValue: null,
  });
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  
  // 보강생 검색
  const [makeupSearch, setMakeupSearch] = useState('');
  const [makeupResults, setMakeupResults] = useState<ClassStudent[]>([]);
  const [isSearchingMakeup, setIsSearchingMakeup] = useState(false);
  
  // Dirty 체크 (페이지 이탈 방지)
  const hasDirtyCards = Object.values(cardDataMap).some(c => c.isDirty);
  
  // ============================================================================
  // 초기 데이터 로드
  // ============================================================================
  
  // 반 목록 로드
  useEffect(() => {
    async function loadClasses() {
      const result = await getTeacherClasses();
      if (result.success && result.data) {
        setClasses(result.data);
        if (result.data.length > 0 && !selectedClassId) {
          setSelectedClassId(result.data[0].id);
        }
      }
    }
    loadClasses();
  }, []);
  
  // 옵션 세트 및 테넌트 설정 로드
  useEffect(() => {
    async function loadSettings() {
      const [optionsResult, settingsResult] = await Promise.all([
        getFeedOptionSets(),
        getTenantSettings(),
      ]);
      
      if (optionsResult.success && optionsResult.data) {
        setOptionSets(optionsResult.data);
      }
      
      if (settingsResult.success && settingsResult.data) {
        setTenantSettings(settingsResult.data);
      }
    }
    loadSettings();
  }, []);
  
  // 반/날짜 변경 시 학생 및 피드 데이터 로드
  useEffect(() => {
    if (!selectedClassId) return;
    
    async function loadStudentsAndFeeds() {
      setIsLoading(true);
      
      try {
        // 학생 목록 로드
        const studentsResult = await getClassStudents(selectedClassId);
        if (!studentsResult.success || !studentsResult.data) {
          toast.error('학생 목록을 불러오는데 실패했습니다');
          return;
        }
        
        setStudents(studentsResult.data);
        
        // 저장된 피드 데이터 로드
        const feedsResult = await getSavedFeeds(selectedClassId, selectedDate);
        const savedFeeds = feedsResult.data || {};
        
        // 카드 데이터 초기화
        const newCardDataMap: Record<string, StudentCardData> = {};
        
        for (const student of studentsResult.data) {
          const saved = savedFeeds[student.id];
          
          // 이전 진도 로드 (progress_enabled일 때만)
          let previousProgress: string | undefined;
          if (tenantSettings.progress_enabled) {
            previousProgress = await getPreviousProgress(student.id, selectedDate) || undefined;
          }
          
          newCardDataMap[student.id] = createCardData(
            student,
            saved,
            previousProgress,
            optionSets
          );
        }
        
        setCardDataMap(newCardDataMap);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadStudentsAndFeeds();
  }, [selectedClassId, selectedDate, optionSets, tenantSettings.progress_enabled]);
  
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
  
  // ============================================================================
  // 카드 데이터 생성 헬퍼
  // ============================================================================
  
  function createCardData(
    student: ClassStudent,
    saved: SavedFeedData | undefined,
    previousProgress: string | undefined,
    optionSets: FeedOptionSet[]
  ): StudentCardData {
    // 피드 값 초기화
    const feedValues: Record<string, string | null> = {};
    optionSets.forEach(set => {
      const savedValue = saved?.feedValues.find(v => v.setId === set.id);
      feedValues[set.id] = savedValue?.optionId || null;
    });
    
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
      memos: saved?.memo ? [saved.memo] : [''],
      materials: saved?.materials || [],
      status,
      isDirty: false,
      savedData: saved,
    };
  }
  
  // ============================================================================
  // 카드 상태 계산
  // ============================================================================
  
  function calculateCardStatus(data: StudentCardData): CardStatus {
    // 결석이면 필수값 검증 스킵
    if (data.attendanceStatus === 'absent') {
      // 결석인데 사유가 없으면 에러
      if (!data.absenceReason) return 'error';
      // 기타인데 상세 사유가 없으면 에러
      if (data.absenceReason === '기타' && !data.absenceReasonDetail) return 'error';
      // 이미 저장되어 있고 변경 없으면 saved
      if (!data.isDirty && data.savedData) return 'saved';
      // 변경됨
      return 'dirty';
    }
    
    // 출석인 경우: 필수 항목 체크
    for (const set of optionSets) {
      if (set.is_required && !data.feedValues[set.id]) {
        return 'error';
      }
    }
    
    // 이미 저장되어 있고 변경 없으면 saved
    if (!data.isDirty && data.savedData) return 'saved';
    
    // 뭐라도 입력했으면 dirty
    const hasAnyValue = Object.values(data.feedValues).some(v => v);
    if (hasAnyValue || data.progressText || data.memos[0]) {
      return 'dirty';
    }
    
    return 'empty';
  }
  
  // ============================================================================
  // 카드 데이터 업데이트 핸들러
  // ============================================================================
  
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
    updateCardData(studentId, {
      attendanceStatus: status,
      absenceReason: status === 'absent' ? reason : undefined,
      absenceReasonDetail: status === 'absent' && reason === '기타' ? detail : undefined,
      notifyParent: status === 'absent' && (reason === '무단' || reason === '지각'),
    });
  }, [updateCardData]);
  
  // 학부모 알림 변경
  const handleNotifyParentChange = useCallback((studentId: string, notify: boolean) => {
    updateCardData(studentId, { notifyParent: notify });
  }, [updateCardData]);
  
  // 진도 변경
  const handleProgressChange = useCallback((studentId: string, progress: string) => {
    updateCardData(studentId, { progressText: progress });
  }, [updateCardData]);
  
  // 메모 변경
  const handleMemoChange = useCallback((studentId: string, memo: string) => {
    updateCardData(studentId, { memos: [memo] });
  }, [updateCardData]);
  
  // 피드 값 변경 (바텀시트에서 선택)
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
  
  // ============================================================================
  // 바텀시트 핸들러
  // ============================================================================
  
  const openBottomSheet = useCallback((studentId: string, setId: string) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    const currentValue = cardDataMap[studentId]?.feedValues[setId] || null;
    
    setBottomSheet({
      isOpen: true,
      studentId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
    });
  }, [optionSets, cardDataMap]);
  
  const closeBottomSheet = useCallback(() => {
    setBottomSheet(prev => ({ ...prev, isOpen: false }));
  }, []);
  
  const handleBottomSheetSelect = useCallback((optionId: string) => {
    if (bottomSheet.studentId && bottomSheet.setId) {
      handleFeedValueChange(bottomSheet.studentId, bottomSheet.setId, optionId);
    }
  }, [bottomSheet.studentId, bottomSheet.setId, handleFeedValueChange]);
  
  // ============================================================================
  // 저장 핸들러
  // ============================================================================
  
  // 단일 저장
  const handleSave = useCallback(async (studentId: string) => {
    const cardData = cardDataMap[studentId];
    if (!cardData) return;
    
    // 유효성 검증
    if (cardData.status === 'error') {
      toast.error(TOAST_MESSAGES.REQUIRED_MISSING);
      return;
    }
    
    setSavingStudentId(studentId);
    
    try {
      const payload: SaveFeedPayload = {
        studentId,
        classId: selectedClassId,
        feedDate: selectedDate,
        attendanceStatus: cardData.attendanceStatus,
        absenceReason: cardData.absenceReason,
        absenceReasonDetail: cardData.absenceReasonDetail,
        notifyParent: cardData.notifyParent,
        isMakeup: cardData.isMakeup,
        progressText: cardData.attendanceStatus === 'present' ? cardData.progressText : undefined,
        memo: cardData.memos[0] || undefined,
        feedValues: cardData.attendanceStatus === 'present'
          ? Object.entries(cardData.feedValues)
              .filter(([_, optionId]) => optionId)
              .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
          : [],
        materials: cardData.materials.map(m => ({
          materialName: m.materialName,
          quantity: m.quantity,
        })),
        idempotencyKey: generateIdempotencyKey(),
      };
      
      const result = await saveFeed(payload);
      
      if (result.success) {
        toast.success(TOAST_MESSAGES.SAVE_SUCCESS);
        
        // 상태 업데이트
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
              isMakeup: cardData.isMakeup,
              progressText: cardData.progressText,
              memo: cardData.memos[0],
              feedValues: Object.entries(cardData.feedValues)
                .filter(([_, optionId]) => optionId)
                .map(([setId, optionId]) => ({ setId, optionId: optionId! })),
              materials: cardData.materials,
            },
          },
        }));
      } else {
        toast.error(result.error || TOAST_MESSAGES.SAVE_ERROR);
      }
    } finally {
      setSavingStudentId(null);
    }
  }, [cardDataMap, selectedClassId, selectedDate]);
  
  // 전체 저장
  const handleSaveAll = useCallback(async () => {
    // dirty 상태인 카드만 저장
    const dirtyCards = Object.values(cardDataMap).filter(c => c.isDirty || c.status === 'dirty');
    
    if (dirtyCards.length === 0) {
      toast.info('저장할 변경사항이 없습니다');
      return;
    }
    
    // 에러 상태 체크
    const errorCards = dirtyCards.filter(c => c.status === 'error');
    if (errorCards.length > 0) {
      toast.error(`${errorCards.length}명의 필수 항목이 누락되었습니다`);
      return;
    }
    
    setIsSaving(true);
    
    try {
      const payloads: SaveFeedPayload[] = dirtyCards.map(cardData => ({
        studentId: cardData.studentId,
        classId: selectedClassId,
        feedDate: selectedDate,
        attendanceStatus: cardData.attendanceStatus,
        absenceReason: cardData.absenceReason,
        absenceReasonDetail: cardData.absenceReasonDetail,
        notifyParent: cardData.notifyParent,
        isMakeup: cardData.isMakeup,
        progressText: cardData.attendanceStatus === 'present' ? cardData.progressText : undefined,
        memo: cardData.memos[0] || undefined,
        feedValues: cardData.attendanceStatus === 'present'
          ? Object.entries(cardData.feedValues)
              .filter(([_, optionId]) => optionId)
              .map(([setId, optionId]) => ({ setId, optionId: optionId! }))
          : [],
        materials: cardData.materials.map(m => ({
          materialName: m.materialName,
          quantity: m.quantity,
        })),
        idempotencyKey: generateIdempotencyKey(),
      }));
      
      const result = await saveAllFeeds(payloads);
      
      const successCount = result.results.filter(r => r.success).length;
      const failCount = result.results.filter(r => !r.success).length;
      
      if (failCount === 0) {
        toast.success(TOAST_MESSAGES.SAVE_ALL_SUCCESS(successCount));
      } else {
        toast.warning(TOAST_MESSAGES.SAVE_ALL_PARTIAL(successCount, failCount));
      }
      
      // 성공한 카드 상태 업데이트
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
    } finally {
      setIsSaving(false);
    }
  }, [cardDataMap, selectedClassId, selectedDate]);
  
  // ============================================================================
  // 보강생 검색/추가
  // ============================================================================
  
  useEffect(() => {
    if (makeupSearch.length < 2) {
      setMakeupResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setIsSearchingMakeup(true);
      const result = await searchMakeupStudents(selectedClassId, makeupSearch);
      if (result.success && result.data) {
        setMakeupResults(result.data);
      }
      setIsSearchingMakeup(false);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [makeupSearch, selectedClassId]);
  
  const addMakeupStudent = useCallback((student: ClassStudent) => {
    // 이미 추가되어 있는지 체크
    if (cardDataMap[student.id]) {
      toast.info(`${student.name}은(는) 이미 목록에 있습니다`);
      return;
    }
    
    // 학생 목록에 추가
    setStudents(prev => [...prev, student]);
    
    // 카드 데이터 추가
    setCardDataMap(prev => ({
      ...prev,
      [student.id]: createCardData(
        { ...student, is_makeup: true },
        undefined,
        undefined,
        optionSets
      ),
    }));
    
    toast.success(TOAST_MESSAGES.MAKEUP_ADDED(student.name));
    setMakeupSearch('');
    setMakeupResults([]);
  }, [cardDataMap, optionSets]);
  
  // ============================================================================
  // 반환
  // ============================================================================
  
  return {
    // 기본 상태
    classes,
    selectedClassId,
    setSelectedClassId,
    selectedDate,
    setSelectedDate,
    
    // 학생 및 피드 데이터
    students,
    cardDataMap,
    optionSets,
    tenantSettings,
    
    // 바텀시트
    bottomSheet,
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetSelect,
    
    // 핸들러
    handleAttendanceChange,
    handleNotifyParentChange,
    handleProgressChange,
    handleMemoChange,
    handleSave,
    handleSaveAll,
    
    // 로딩 상태
    isLoading,
    isSaving,
    savingStudentId,
    hasDirtyCards,
    
    // 보강생 검색
    makeupSearch,
    setMakeupSearch,
    makeupResults,
    isSearchingMakeup,
    addMakeupStudent,
  };
}
