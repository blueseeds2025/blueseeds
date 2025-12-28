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
  MemoField,
} from '../types';
import {
  getTeacherClasses,
  getClassStudents,
  getFeedOptionSets,
  getSavedFeeds,
  getPreviousProgressBatch,
  getTenantSettings,
  saveFeed,
  saveAllFeeds,
  searchMakeupStudents,
  getPendingMakeupTickets,
  PendingMakeupTicket,
} from '../actions/feed.actions';
import { 
  formatDate, 
  generateIdempotencyKey,
  TOAST_MESSAGES 
} from '../constants';
import { toast } from 'sonner';

interface UseFeedInputProps {
  classId: string;
  date: string;
  teacherId: string;
  tenantId: string;
}

// 보강생 정보 (티켓 ID 포함)
interface MakeupStudentInfo extends ClassStudent {
  makeupTicketId?: string;
}

export function useFeedInput({ classId, date, teacherId, tenantId }: UseFeedInputProps) {
  // 학생 및 피드 데이터
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [cardDataMap, setCardDataMap] = useState<Record<string, StudentCardData>>({});
  const [optionSets, setOptionSets] = useState<FeedOptionSet[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({
    progress_enabled: false,
    materials_enabled: false,
    makeup_defaults: {
      '병결': true,
      '학교행사': true,
      '가사': false,
      '무단': false,
      '기타': true,
    },
  });
  
  // 보강 티켓 ID 매핑 (studentId → ticketId)
  const [makeupTicketMap, setMakeupTicketMap] = useState<Record<string, string>>({});
  
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
  
  // 보강생 검색 (기존 - 사용 안함)
  const [makeupSearch, setMakeupSearch] = useState('');
  const [makeupResults, setMakeupResults] = useState<ClassStudent[]>([]);
  const [isSearchingMakeup, setIsSearchingMakeup] = useState(false);
  
  // 보강 대기 목록 (신규)
  const [pendingMakeupTickets, setPendingMakeupTickets] = useState<PendingMakeupTicket[]>([]);
  const [isLoadingMakeupTickets, setIsLoadingMakeupTickets] = useState(false);
  const [makeupPanelOpen, setMakeupPanelOpen] = useState(false);
  const [makeupSearchQuery, setMakeupSearchQuery] = useState('');
  
  // ========================================
  // 보강 전용 상태 (정규 피드와 완전 분리)
  // ========================================
  const [makeupCardDataMap, setMakeupCardDataMap] = useState<Record<string, StudentCardData>>({});
  // key: ticketId, value: { studentId, cardData 등 }
  
  // 메모 필드 (특이사항 고정 + 추가 가능)
  const [memoFields, setMemoFields] = useState<MemoField[]>([
    { id: 'default', name: '특이사항', isFixed: true }
  ]);
  
  // Dirty 체크 (페이지 이탈 방지)
  const hasDirtyCards = Object.values(cardDataMap).some(c => c.isDirty);
  
  // ============================================================================
  // 메모 필드 관리
  // ============================================================================
  
  const addMemoField = useCallback((name: string) => {
    const newField: MemoField = {
      id: `memo_${Date.now()}`,
      name,
      isFixed: false,
    };
    setMemoFields(prev => [...prev, newField]);
    
    // 모든 카드에 새 메모 필드 추가
    setCardDataMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(studentId => {
        updated[studentId] = {
          ...updated[studentId],
          memoValues: {
            ...updated[studentId].memoValues,
            [newField.id]: '',
          },
        };
      });
      return updated;
    });
  }, []);
  
  const removeMemoField = useCallback((fieldId: string) => {
    setMemoFields(prev => prev.filter(f => f.id !== fieldId));
    
    // 모든 카드에서 해당 메모 필드 제거
    setCardDataMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(studentId => {
        const { [fieldId]: removed, ...rest } = updated[studentId].memoValues;
        updated[studentId] = {
          ...updated[studentId],
          memoValues: rest,
        };
      });
      return updated;
    });
  }, []);
  
  const renameMemoField = useCallback((fieldId: string, newName: string) => {
    setMemoFields(prev => 
      prev.map(f => f.id === fieldId ? { ...f, name: newName } : f)
    );
  }, []);
  
  // ============================================================================
  // 초기 데이터 로드
  // ============================================================================
  
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
    if (!classId) return;
    
    async function loadStudentsAndFeeds() {
      setIsLoading(true);
      
      // 보강 티켓 맵 초기화 (반 변경 시)
      setMakeupTicketMap({});
      
      try {
        // 학생 목록 + 피드 데이터 동시 로드
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
        
        // 이전 진도 일괄 조회 (progress_enabled일 때만)
        let previousProgressMap: Record<string, string> = {};
        if (tenantSettings.progress_enabled && studentsResult.data.length > 0) {
          const studentIds = studentsResult.data.map(s => s.id);
          previousProgressMap = await getPreviousProgressBatch(studentIds, date);
        }
        
        // 카드 데이터 초기화
        const newCardDataMap: Record<string, StudentCardData> = {};
        
        for (const student of studentsResult.data) {
          const saved = savedFeeds[student.id];
          const previousProgress = previousProgressMap[student.id];
          
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
    
    // 메모 값 초기화 (기본: 특이사항)
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
    
    // 출석인 경우: 모든 피드 항목 필수 체크 (메모 제외)
    for (const set of optionSets) {
      if (!data.feedValues[set.id]) {
        return 'error';  // 하나라도 비어있으면 에러
      }
    }
    
    // 이미 저장되어 있고 변경 없으면 saved
    if (!data.isDirty && data.savedData) return 'saved';
    
    // 모든 항목 입력됨 → dirty (저장 대기)
    return 'dirty';
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
    // 결석 사유별 보강 기본값 가져오기
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
  
  // 메모 변경 (필드별)
  const handleMemoChange = useCallback((studentId: string, fieldId: string, value: string) => {
    setCardDataMap(prev => {
      const current = prev[studentId];
      if (!current) return prev;
      
      const updated = {
        ...current,
        memoValues: {
          ...current.memoValues,
          [fieldId]: value,
        },
        isDirty: true,
      };
      updated.status = calculateCardStatus(updated);
      
      return { ...prev, [studentId]: updated };
    });
  }, [optionSets]);
  
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
    
    // 보강 여부 판단: makeupTicketMap에 있으면 보강
    const ticketId = makeupTicketMap[studentId];
    const isMakeupSession = !!ticketId;
    
    // 디버그 로그
    console.log('handleSave:', { 
      studentId, 
      ticketId, 
      isMakeupSession,
      makeupTicketMap,
      cardDataIsMakeup: cardData.isMakeup 
    });
    
    try {
      const payload: SaveFeedPayload = {
        studentId,
        classId: classId,
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
              isMakeup: isMakeupSession,
              progressText: cardData.progressText,
              memoValues: cardData.memoValues,
              feedValues: Object.entries(cardData.feedValues)
                .filter(([_, optionId]) => optionId)
                .map(([setId, optionId]) => ({ setId, optionId: optionId! })),
            },
          },
        }));
        
        // 보강생 저장 완료 시 티켓 맵에서 제거
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
  }, [cardDataMap, classId, date, makeupTicketMap]);
  
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
      const payloads: SaveFeedPayload[] = dirtyCards.map(cardData => {
        const ticketId = makeupTicketMap[cardData.studentId];
        const isMakeupSession = !!ticketId;
        
        return {
          studentId: cardData.studentId,
          classId: classId,
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
      
      // 보강생 저장 완료 시 티켓 맵 정리
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
  }, [cardDataMap, classId, date, makeupTicketMap]);
  
  // ============================================================================
  // 보강 대기 목록 조회 (신규)
  // ============================================================================
  
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
  
  // 보강 패널 닫기 (상태 초기화)
  const closeMakeupPanel = useCallback(() => {
    setMakeupPanelOpen(false);
    setMakeupSearchQuery('');
    setMakeupCardDataMap({});  // 보강 카드 초기화
    setMakeupTicketMap({});    // 티켓 맵 초기화
  }, []);
  
  // 필터된 보강 대기 목록
  const filteredMakeupTickets = makeupSearchQuery.length >= 1
    ? pendingMakeupTickets.filter(t => 
        t.studentName.includes(makeupSearchQuery) ||
        t.displayCode.includes(makeupSearchQuery)
      )
    : pendingMakeupTickets;
  
  // ============================================================================
  // 보강생 추가 (신규 - 티켓 기반, 보강 전용 상태에 추가)
  // ============================================================================
  
  const addMakeupStudentFromTicket = useCallback((ticket: PendingMakeupTicket) => {
    // 이 티켓으로 이미 추가되어 있는지 체크 (티켓 ID로 체크)
    if (makeupCardDataMap[ticket.id]) {
      toast.info(`${ticket.studentName}은(는) 이미 추가되었습니다`);
      return;
    }
    
    const student: ClassStudent = {
      id: ticket.studentId,
      name: ticket.studentName,
      display_code: ticket.displayCode,
      class_id: ticket.classId,  // 원래 반 ID
      is_makeup: true,
    };
    
    // 보강 전용 카드 데이터 생성 (ticketId를 키로 사용)
    const newCardData = createCardData(
      student,
      undefined,  // 빈 카드
      undefined,
      optionSets
    );
    
    // 보강 전용 맵에 추가 (ticketId가 키)
    setMakeupCardDataMap(prev => ({
      ...prev,
      [ticket.id]: {
        ...newCardData,
        // 추가 정보 저장
        makeupTicketId: ticket.id,
      } as StudentCardData,
    }));
    
    // 보강 티켓 ID 매핑 저장 (studentId -> ticketId)
    setMakeupTicketMap(prev => ({
      ...prev,
      [ticket.studentId]: ticket.id,
    }));
    
    toast.success(`${ticket.studentName} 보강생 추가됨`);
  }, [makeupCardDataMap, optionSets]);
  
  // ============================================================================
  // 기존 보강생 검색/추가 (하위 호환용)
  // ============================================================================
  
  useEffect(() => {
    if (makeupSearch.length < 2) {
      setMakeupResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setIsSearchingMakeup(true);
      const result = await searchMakeupStudents(classId, makeupSearch);
      if (result.success && result.data) {
        setMakeupResults(result.data);
      }
      setIsSearchingMakeup(false);
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [makeupSearch, classId]);
  
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
    
    toast.success(`${student.name} 보강생 추가됨`);
    setMakeupSearch('');
    setMakeupResults([]);
  }, [cardDataMap, optionSets]);
  
  // ============================================================================
  // 보강 전용 핸들러 (정규 피드와 완전 분리)
  // ============================================================================
  
  // 보강 카드 출결 변경
  const handleMakeupAttendanceChange = useCallback((ticketId: string, status: AttendanceStatus, reason?: string, detail?: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      return {
        ...prev,
        [ticketId]: {
          ...cardData,
          attendanceStatus: status,
          absenceReason: reason,
          absenceReasonDetail: detail,
          isDirty: true,
          status: 'dirty',
        },
      };
    });
  }, []);
  
  // 보강 카드 진도 변경
  const handleMakeupProgressChange = useCallback((ticketId: string, progress: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      return {
        ...prev,
        [ticketId]: {
          ...cardData,
          progressText: progress,
          isDirty: true,
          status: 'dirty',
        },
      };
    });
  }, []);
  
  // 보강 카드 메모 변경
  const handleMakeupMemoChange = useCallback((ticketId: string, memoId: string, value: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      return {
        ...prev,
        [ticketId]: {
          ...cardData,
          memoValues: {
            ...cardData.memoValues,
            [memoId]: value,
          },
          isDirty: true,
          status: 'dirty',
        },
      };
    });
  }, []);
  
  // 보강 카드 피드 값 변경
  const handleMakeupFeedValueChange = useCallback((ticketId: string, setId: string, optionId: string) => {
    setMakeupCardDataMap(prev => {
      const cardData = prev[ticketId];
      if (!cardData) return prev;
      
      return {
        ...prev,
        [ticketId]: {
          ...cardData,
          feedValues: {
            ...cardData.feedValues,
            [setId]: optionId,
          },
          isDirty: true,
          status: 'dirty',
        },
      };
    });
  }, []);
  
  // 보강 피드 저장 (단일)
  const handleMakeupSave = useCallback(async (ticketId: string) => {
    const cardData = makeupCardDataMap[ticketId];
    if (!cardData) return;
    
    // 유효성 검증
    if (cardData.status === 'error') {
      toast.error(TOAST_MESSAGES.REQUIRED_MISSING);
      return;
    }
    
    setSavingStudentId(ticketId);
    
    console.log('handleMakeupSave:', { ticketId, cardData });
    
    try {
      const payload: SaveFeedPayload = {
        studentId: cardData.studentId,
        classId: classId,  // 현재 선택된 반 (보강 받은 반)
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
      
      console.log('Makeup payload:', payload);
      
      const result = await saveFeed(payload);
      
      if (result.success) {
        toast.success(TOAST_MESSAGES.SAVE_SUCCESS);
        
        // 보강 카드 상태 업데이트
        setMakeupCardDataMap(prev => ({
          ...prev,
          [ticketId]: {
            ...prev[ticketId],
            status: 'saved',
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
    const dirtyCards = Object.entries(makeupCardDataMap).filter(([_, card]) => card.isDirty || card.status === 'dirty');
    
    if (dirtyCards.length === 0) {
      toast.info('저장할 변경사항이 없습니다');
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
              status: 'saved',
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
  
  // ============================================================================
  // 반환
  // ============================================================================
  
  return {
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
    
    // 핸들러 (정규 피드)
    handleAttendanceChange,
    handleNotifyParentChange,
    handleNeedsMakeupChange,
    handleProgressChange,
    handleMemoChange,
    handleFeedValueChange,
    handleSave,
    handleSaveAll,
    
    // 로딩 상태
    isLoading,
    isSaving,
    savingStudentId,
    hasDirtyCards,
    dirtyCount: Object.values(cardDataMap).filter(c => c.isDirty || c.status === 'dirty').length,
    
    // 보강 대기 목록 (신규)
    pendingMakeupTickets: filteredMakeupTickets,
    isLoadingMakeupTickets,
    makeupPanelOpen,
    makeupSearchQuery,
    setMakeupSearchQuery,
    openMakeupPanel,
    closeMakeupPanel,
    addMakeupStudentFromTicket,
    loadPendingMakeupTickets,
    
    // 보강 전용 상태 및 핸들러
    makeupCardDataMap,
    handleMakeupAttendanceChange,
    handleMakeupProgressChange,
    handleMakeupMemoChange,
    handleMakeupFeedValueChange,
    handleMakeupSave,
    handleMakeupSaveAll,
    makeupDirtyCount: Object.values(makeupCardDataMap).filter(c => c.isDirty || c.status === 'dirty').length,
    
    // 기존 보강생 검색 (하위 호환)
    makeupSearch,
    setMakeupSearch,
    makeupResults,
    isSearchingMakeup,
    addMakeupStudent,
    
    // 메모 필드 관리
    memoFields,
    addMemoField,
    removeMemoField,
    renameMemoField,
  };
}