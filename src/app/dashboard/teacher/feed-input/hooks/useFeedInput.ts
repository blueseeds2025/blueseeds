'use client';

import { useState, useCallback } from 'react';
import {
  ClassStudent,
  FeedOptionSet,
  ExamType,
  TenantSettings,
  Textbook,
  SavedFeedData,
  ProgressEntry,
} from '../types';
import { toast } from 'sonner';

// 분리된 훅들
import { useBottomSheet } from './useBottomSheet';
import { useMemoFields } from './useMemoFields';
import { useFeedRegular } from './useFeedRegular';
import { useFeedMakeup } from './useFeedMakeup';

// ============================================================================
// Props 타입 - 서버에서 받은 초기 데이터 포함
// ============================================================================

interface UseFeedInputProps {
  classId: string;
  date: string;
  teacherId: string;
  tenantId: string;
  // 🆕 서버에서 받은 정적 데이터
  initialOptionSets: FeedOptionSet[];
  initialExamTypes: ExamType[];
  initialTextbooks: Textbook[];
  initialTenantSettings: TenantSettings;
  // 🆕 서버에서 받은 동적 데이터 (초기값)
  initialStudents: ClassStudent[];
  initialSavedFeeds: Record<string, SavedFeedData>;
  initialPreviousProgressMap: Record<string, string>;
  initialPreviousProgressEntriesMap: Record<string, ProgressEntry[]>;
  // 🆕 초기 classId/date (서버에서 데이터 가져온 기준)
  serverClassId: string;
  serverDate: string;
}

export function useFeedInput({
  classId,
  date,
  teacherId,
  tenantId,
  initialOptionSets,
  initialExamTypes,
  initialTextbooks,
  initialTenantSettings,
  initialStudents,
  initialSavedFeeds,
  initialPreviousProgressMap,
  initialPreviousProgressEntriesMap,
  serverClassId,
  serverDate,
}: UseFeedInputProps) {
  // ✅ 서버에서 받은 정적 데이터 그대로 사용 (useEffect 제거)
  const optionSets = initialOptionSets;
  const examTypes = initialExamTypes;
  const textbooks = initialTextbooks;
  const tenantSettings = initialTenantSettings;
  
  // 보강 티켓 맵 (정규/보강 훅에서 공유)
  const [makeupTicketMap, setMakeupTicketMap] = useState<Record<string, string>>({});

  // 정규 피드 훅 - 🆕 서버 초기 데이터 전달
  const regularFeed = useFeedRegular({
    classId,
    date,
    optionSets,
    examTypes,
    textbooks,
    tenantSettings,
    makeupTicketMap,
    setMakeupTicketMap,
    // 🆕 서버 초기 데이터
    initialStudents,
    initialSavedFeeds,
    initialPreviousProgressMap,
    initialPreviousProgressEntriesMap,
    serverClassId,
    serverDate,
  });

  // 메모 필드 훅
  const memoFieldsHook = useMemoFields({
    setCardDataMap: regularFeed.setCardDataMap,
  });

  // 바텀시트 훅
  const bottomSheetHook = useBottomSheet({
    optionSets,
    cardDataMap: regularFeed.cardDataMap,
    onSelect: regularFeed.handleFeedValueChange,
  });

  // 보강 피드 훅
  const makeupFeed = useFeedMakeup({
    classId,
    date,
    optionSets,
    tenantSettings,
  });

  // 기존 보강생 검색 (정규 목록에 추가) - 하위 호환
  const addMakeupStudent = useCallback((student: ClassStudent) => {
    if (regularFeed.cardDataMap[student.id]) {
      toast.info(`${student.name}은(는) 이미 목록에 있습니다`);
      return;
    }
    
    regularFeed.setStudents(prev => [...prev, student]);
    
    const feedValues: Record<string, string | null> = {};
    optionSets.forEach(set => {
      feedValues[set.id] = null;
    });
    
    const examScoresInit: Record<string, number | null> = {};
    examTypes.forEach(exam => {
      examScoresInit[exam.id] = null;
    });
    
    regularFeed.setCardDataMap(prev => ({
      ...prev,
      [student.id]: {
        studentId: student.id,
        studentName: student.name,
        isMakeup: true,
        attendanceStatus: 'present',
        absenceReason: undefined,
        absenceReasonDetail: undefined,
        notifyParent: false,
        progressText: undefined,
        previousProgress: undefined,
        progressEntries: [],
        feedValues,
        examScores: examScoresInit,
        memoValues: { 'default': '' },
        materials: [],
        status: 'empty',
        isDirty: false,
        savedData: undefined,
      },
    }));
    
    toast.success(`${student.name} 보강생 추가됨`);
    makeupFeed.setMakeupSearch('');
  }, [regularFeed.cardDataMap, optionSets, examTypes]);

  return {
    // 학생 및 피드 데이터
    students: regularFeed.students,
    cardDataMap: regularFeed.cardDataMap,
    optionSets,
    examTypes,
    textbooks,
    tenantSettings,
    previousProgressEntriesMap: regularFeed.previousProgressEntriesMap,
    
    // 바텀시트
    bottomSheet: bottomSheetHook.bottomSheet,
    openBottomSheet: bottomSheetHook.openBottomSheet,
    closeBottomSheet: bottomSheetHook.closeBottomSheet,
    handleBottomSheetSelect: bottomSheetHook.handleBottomSheetSelect,
    
    // 핸들러 (정규 피드)
    handleAttendanceChange: regularFeed.handleAttendanceChange,
    handleNotifyParentChange: regularFeed.handleNotifyParentChange,
    handleNeedsMakeupChange: regularFeed.handleNeedsMakeupChange,
    handleProgressChange: regularFeed.handleProgressChange,
    handleProgressEntriesChange: regularFeed.handleProgressEntriesChange,
    handleApplyProgressToAll: regularFeed.handleApplyProgressToAll,
    handleMemoChange: regularFeed.handleMemoChange,
    handleFeedValueChange: regularFeed.handleFeedValueChange,
    handleExamScoreChange: regularFeed.handleExamScoreChange,
    handleSave: regularFeed.handleSave,
    handleSaveAll: regularFeed.handleSaveAll,
    
    // 로딩 상태
    isLoading: regularFeed.isLoading,
    isSaving: regularFeed.isSaving || makeupFeed.isSaving,
    savingStudentId: regularFeed.savingStudentId || makeupFeed.savingStudentId,
    hasDirtyCards: regularFeed.hasDirtyCards,
    dirtyCount: regularFeed.dirtyCount,
    
    // 보강 대기 목록 (신규)
    pendingMakeupTickets: makeupFeed.pendingMakeupTickets,
    isLoadingMakeupTickets: makeupFeed.isLoadingMakeupTickets,
    makeupPanelOpen: makeupFeed.makeupPanelOpen,
    makeupSearchQuery: makeupFeed.makeupSearchQuery,
    setMakeupSearchQuery: makeupFeed.setMakeupSearchQuery,
    openMakeupPanel: makeupFeed.openMakeupPanel,
    closeMakeupPanel: makeupFeed.closeMakeupPanel,
    addMakeupStudentFromTicket: makeupFeed.addMakeupStudentFromTicket,
    loadPendingMakeupTickets: makeupFeed.loadPendingMakeupTickets,
    
    // 보강 전용 상태 및 핸들러
    makeupCardDataMap: makeupFeed.makeupCardDataMap,
    handleMakeupAttendanceChange: makeupFeed.handleMakeupAttendanceChange,
    handleMakeupProgressChange: makeupFeed.handleMakeupProgressChange,
    handleMakeupMemoChange: makeupFeed.handleMakeupMemoChange,
    handleMakeupFeedValueChange: makeupFeed.handleMakeupFeedValueChange,
    handleMakeupSave: makeupFeed.handleMakeupSave,
    handleMakeupSaveAll: makeupFeed.handleMakeupSaveAll,
    makeupDirtyCount: makeupFeed.makeupDirtyCount,
    
    // 티켓 직접 처리 (날짜 예약, 보강 안함)
    handleScheduleTicket: makeupFeed.handleScheduleTicket,
    handleCancelTicket: makeupFeed.handleCancelTicket,
    processingTicketId: makeupFeed.processingTicketId,
    
    // 기존 보강생 검색 (하위 호환)
    makeupSearch: makeupFeed.makeupSearch,
    setMakeupSearch: makeupFeed.setMakeupSearch,
    makeupResults: makeupFeed.makeupResults,
    isSearchingMakeup: makeupFeed.isSearchingMakeup,
    addMakeupStudent,
    
    // 메모 필드 관리
    memoFields: memoFieldsHook.memoFields,
    addMemoField: memoFieldsHook.addMemoField,
    removeMemoField: memoFieldsHook.removeMemoField,
    renameMemoField: memoFieldsHook.renameMemoField,
  };
}
