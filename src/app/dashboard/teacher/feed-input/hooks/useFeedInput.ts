'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClassStudent,
  FeedOptionSet,
  TenantSettings,
} from '../types';
import {
  getTeacherClasses,
  getFeedOptionSets,
  getTenantSettings,
  searchMakeupStudents,
} from '../actions/feed.actions';
import { toast } from 'sonner';

// 분리된 훅들
import { useBottomSheet } from './useBottomSheet';
import { useMemoFields } from './useMemoFields';
import { useFeedRegular } from './useFeedRegular';
import { useFeedMakeup } from './useFeedMakeup';

interface UseFeedInputProps {
  classId: string;
  date: string;
  teacherId: string;
  tenantId: string;
}

export function useFeedInput({ classId, date, teacherId, tenantId }: UseFeedInputProps) {
  // 공통 설정
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
    plan: 'basic',
    features: [],
  });
  
  // 보강 티켓 맵 (정규/보강 훅에서 공유)
  const [makeupTicketMap, setMakeupTicketMap] = useState<Record<string, string>>({});

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

  // 정규 피드 훅
  const regularFeed = useFeedRegular({
    classId,
    date,
    optionSets,
    tenantSettings,
    makeupTicketMap,
    setMakeupTicketMap,
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
        feedValues,
        memoValues: { 'default': '' },
        materials: [],
        status: 'empty',
        isDirty: false,
        savedData: undefined,
      },
    }));
    
    toast.success(`${student.name} 보강생 추가됨`);
    makeupFeed.setMakeupSearch('');
  }, [regularFeed.cardDataMap, optionSets]);

  return {
    // 학생 및 피드 데이터
    students: regularFeed.students,
    cardDataMap: regularFeed.cardDataMap,
    optionSets,
    tenantSettings,
    
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
    handleMemoChange: regularFeed.handleMemoChange,
    handleFeedValueChange: regularFeed.handleFeedValueChange,
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