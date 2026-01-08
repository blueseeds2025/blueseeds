'use client';

import { useState, useRef, useCallback } from 'react';
import FeedOptionPicker from './components/FeedOptionPicker';
import { useFeedInput } from './hooks/useFeedInput';
import { useResponsiveGrid } from './hooks/useResponsiveGrid';
import { useBeforeUnloadDirty } from './hooks/useBeforeUnloadDirty';
import { formatDisplayDate } from './constants';
import { 
  AddMemoModal,
  ScheduleModal,
  CancelModal,
  StudentGrid,
  MakeupPanel,
} from './components';
import { 
  FeedOption, 
  ProgressEntry,
  FeedOptionSet,
  ExamType,
  Textbook,
  TenantSettings,
  ClassStudent,
  SavedFeedData,
} from './types';

// ============================================================================
// Props
// ============================================================================

interface FeedInputClientProps {
  initialClasses: { id: string; name: string; color?: string }[];
  initialOptionSets: FeedOptionSet[];
  initialExamTypes: ExamType[];
  initialTextbooks: Textbook[];
  initialTenantSettings: TenantSettings;
  initialClassId: string;
  initialDate: string;
  initialStudents: ClassStudent[];
  initialSavedFeeds: Record<string, SavedFeedData>;
  initialPreviousProgressMap: Record<string, string>;
  initialPreviousProgressEntriesMap: Record<string, ProgressEntry[]>;
  teacherId: string;
  tenantId: string;
}

// ============================================================================
// Component
// ============================================================================

export default function FeedInputClient({
  initialClasses,
  initialOptionSets,
  initialExamTypes,
  initialTextbooks,
  initialTenantSettings,
  initialClassId,
  initialDate,
  initialStudents,
  initialSavedFeeds,
  initialPreviousProgressMap,
  initialPreviousProgressEntriesMap,
  teacherId,
  tenantId,
}: FeedInputClientProps) {
  const classes = initialClasses || [];
  const today = new Date().toISOString().split('T')[0];
  
  // ============================================================================
  // 핵심 상태
  // ============================================================================
  
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ============================================================================
  // 모달 상태
  // ============================================================================
  
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [newMemoName, setNewMemoName] = useState('');
  
  const [scheduleModal, setScheduleModal] = useState({
    open: false,
    ticketId: '',
    studentName: '',
  });
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');
  
  const [cancelModal, setCancelModal] = useState({
    open: false,
    ticketId: '',
    studentName: '',
  });
  const [cancelReason, setCancelReason] = useState('');
  
  // ✅ 옵션 피커 상태 (currentValue 포함)
  const [optionPicker, setOptionPicker] = useState<{
    isOpen: boolean;
    studentId: string | null;
    setId: string | null;
    setName: string | null;
    options: FeedOption[];
    currentValue: string | null;
    anchorEl: HTMLElement | null;
    isMakeup: boolean;
  }>({
    isOpen: false,
    studentId: null,
    setId: null,
    setName: null,
    options: [],
    currentValue: null,
    anchorEl: null,
    isMakeup: false,
  });
  
  // 보강 모달용 상태
  const [addedTicketIds, setAddedTicketIds] = useState<string[]>([]);
  
  // ============================================================================
  // 훅
  // ============================================================================
  
  const {
    students,
    cardDataMap,
    optionSets,
    examTypes,
    textbooks,
    tenantSettings,
    previousProgressEntriesMap,
    memoFields,
    isLoading,
    isSaving,
    savingStudentId,
    hasDirtyCards,
    dirtyCount,
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
    addMemoField,
    removeMemoField,
    // 보강 관련
    pendingMakeupTickets,
    isLoadingMakeupTickets,
    makeupPanelOpen,
    makeupSearchQuery,
    setMakeupSearchQuery,
    openMakeupPanel,
    closeMakeupPanel,
    addMakeupStudentFromTicket,
    loadPendingMakeupTickets,
    makeupCardDataMap,
    handleMakeupAttendanceChange,
    handleMakeupProgressChange,
    handleMakeupMemoChange,
    handleMakeupFeedValueChange,
    handleMakeupSave,
    handleMakeupSaveAll,
    makeupDirtyCount,
    handleScheduleTicket,
    handleCancelTicket,
    processingTicketId,
  } = useFeedInput({
    classId: selectedClassId,
    date: selectedDate,
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
    serverClassId: initialClassId,
    serverDate: initialDate,
  });
  
  // 그리드 클래스 계산
  const gridClass = useResponsiveGrid({ containerRef, itemCount: students.length });
  
  // 페이지 이탈 방지
  useBeforeUnloadDirty(hasDirtyCards);
  
  // ============================================================================
  // 핸들러 (✅ cardDataMap 의존성 제거됨)
  // ============================================================================
  
  // ✅ currentValue를 파라미터로 받아서 cardDataMap 의존성 제거
  const openOptionPicker = useCallback((
    studentId: string, 
    setId: string, 
    anchorEl: HTMLElement,
    currentValue: string | null
  ) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    setOptionPicker({
      isOpen: true,
      studentId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
      anchorEl,
      isMakeup: false,
    });
  }, [optionSets]); // ✅ cardDataMap 제거됨
  
  // ✅ 완전 reset
  const closeOptionPicker = useCallback(() => {
    setOptionPicker({
      isOpen: false,
      studentId: null,
      setId: null,
      setName: null,
      options: [],
      currentValue: null,
      anchorEl: null,
      isMakeup: false,
    });
  }, []);
  
  // ✅ 선택 후 자동 close
  const handleOptionSelect = useCallback((optionId: string) => {
    if (optionPicker.studentId && optionPicker.setId) {
      if (optionPicker.isMakeup) {
        handleMakeupFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
      } else {
        handleFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
      }
      closeOptionPicker(); // ✅ 자동 close
    }
  }, [optionPicker, handleFeedValueChange, handleMakeupFeedValueChange, closeOptionPicker]);
  
  const handleAddMemoField = useCallback(() => {
    if (newMemoName.trim()) {
      addMemoField(newMemoName.trim());
      setNewMemoName('');
      setShowAddMemo(false);
    }
  }, [newMemoName, addMemoField]);
  
  const handleAddMakeupStudent = useCallback((ticket: Parameters<typeof addMakeupStudentFromTicket>[0]) => {
    addMakeupStudentFromTicket(ticket);
    setAddedTicketIds(prev => [...prev, ticket.id]);
  }, [addMakeupStudentFromTicket]);
  
  const handleCloseMakeupModal = useCallback(() => {
    closeMakeupPanel();
    setAddedTicketIds([]);
    setMakeupSearchQuery('');
  }, [closeMakeupPanel, setMakeupSearchQuery]);
  
  const handleSaveMakeupAndClose = useCallback(async () => {
    await handleMakeupSaveAll();
    await loadPendingMakeupTickets();
    handleCloseMakeupModal();
  }, [handleMakeupSaveAll, loadPendingMakeupTickets, handleCloseMakeupModal]);
  
  // ✅ 보강용 옵션 피커 (currentValue 파라미터로 받음)
  const openMakeupOptionPicker = useCallback((
    ticketId: string, 
    setId: string, 
    anchorEl: HTMLElement,
    currentValue: string | null
  ) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    setOptionPicker({
      isOpen: true,
      studentId: ticketId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
      anchorEl,
      isMakeup: true,
    });
  }, [optionSets]); // ✅ makeupCardDataMap 제거됨
  
  const handleScheduleOpen = useCallback((
    ticketId: string, 
    studentName: string, 
    currentDate?: string | null, 
    currentTime?: string | null
  ) => {
    setScheduleModal({ open: true, ticketId, studentName });
    setScheduleDate(currentDate || '');
    if (currentTime) {
      const [h, m] = currentTime.split(':');
      setScheduleHour(h);
      setScheduleMinute(m);
    } else {
      setScheduleHour('');
      setScheduleMinute('');
    }
  }, []);
  
  const handleCancelOpen = useCallback((ticketId: string, studentName: string) => {
    setCancelModal({ open: true, ticketId, studentName });
    setCancelReason('');
  }, []);
  
  const handleScheduleConfirm = useCallback(async () => {
    if (!scheduleDate) return;
    const time = scheduleHour && scheduleMinute ? `${scheduleHour}:${scheduleMinute}:00` : undefined;
    await handleScheduleTicket(scheduleModal.ticketId, scheduleDate, time);
    setScheduleModal({ open: false, ticketId: '', studentName: '' });
  }, [scheduleDate, scheduleHour, scheduleMinute, scheduleModal.ticketId, handleScheduleTicket]);
  
  const handleCancelConfirm = useCallback(async () => {
    if (!cancelReason.trim()) return;
    await handleCancelTicket(cancelModal.ticketId, cancelReason);
    setCancelModal({ open: false, ticketId: '', studentName: '' });
  }, [cancelReason, cancelModal.ticketId, handleCancelTicket]);
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* 상단 고정 바 */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#6B7280]">날짜</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={today}
                className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
              />
              <span className="text-sm text-[#6B7280]">
                {formatDisplayDate(new Date(selectedDate))}
              </span>
            </div>
            
            {/* 반 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#6B7280]">반</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 min-w-[150px]"
              >
                {classes.length === 0 ? (
                  <option value="">담당 반이 없습니다</option>
                ) : (
                  classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
              </select>
            </div>
            
            {/* 메모 추가 버튼 */}
            <button
              onClick={() => setShowAddMemo(true)}
              className="px-3 py-2 border border-dashed border-[#D1D5DB] rounded-lg text-sm text-[#6B7280] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
            >
              + 메모 추가
            </button>
            
            {/* 보강 버튼 */}
            {tenantSettings.features?.includes('makeup_system') && (
              <button
                onClick={openMakeupPanel}
                className="px-3 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <span>📋</span>
                <span>보강</span>
              </button>
            )}
            
            {/* 전체 저장 버튼 */}
            <div className="ml-auto">
              <button
                onClick={handleSaveAll}
                disabled={isSaving || dirtyCount === 0}
                className={`
                  px-6 py-2 rounded-lg font-medium transition-all
                  ${dirtyCount > 0
                    ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white'
                    : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                  }
                `}
              >
                {isSaving ? '저장 중...' : `전체 저장 ${dirtyCount > 0 ? `(${dirtyCount})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* ✅ 보강 모달 - 별도 컴포넌트로 분리됨 */}
      <MakeupPanel
        isOpen={makeupPanelOpen}
        onClose={handleCloseMakeupModal}
        tickets={pendingMakeupTickets}
        isLoadingTickets={isLoadingMakeupTickets}
        searchQuery={makeupSearchQuery}
        onSearchChange={setMakeupSearchQuery}
        addedTicketIds={addedTicketIds}
        onAddTicket={handleAddMakeupStudent}
        cardDataMap={makeupCardDataMap}
        optionSets={optionSets}
        tenantSettings={tenantSettings}
        memoFields={memoFields}
        onAttendanceChange={handleMakeupAttendanceChange}
        onProgressChange={handleMakeupProgressChange}
        onMemoChange={handleMakeupMemoChange}
        onOpenOptionPicker={openMakeupOptionPicker}
        onSave={handleMakeupSave}
        onSaveAll={handleSaveMakeupAndClose}
        onScheduleTicket={handleScheduleOpen}
        onCancelTicket={handleCancelOpen}
        processingTicketId={processingTicketId}
        dirtyCount={makeupDirtyCount}
        isSaving={isSaving}
        savingStudentId={savingStudentId}
      />
      
      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#6366F1] border-t-transparent mx-auto mb-4" />
              <p className="text-[#6B7280]">불러오는 중...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#6B7280] text-lg">이 반에 등록된 학생이 없습니다</p>
            <p className="text-[#9CA3AF] text-sm mt-2">학생 관리에서 학생을 추가해주세요</p>
          </div>
        ) : (
          <StudentGrid
            students={students}
            cardDataMap={cardDataMap}
            optionSets={optionSets}
            examTypes={examTypes}
            textbooks={textbooks}
            previousProgressEntriesMap={previousProgressEntriesMap}
            tenantSettings={tenantSettings}
            memoFields={memoFields}
            gridClass={gridClass}
            savingStudentId={savingStudentId}
            onOpenOptionPicker={openOptionPicker}
            onAttendanceChange={handleAttendanceChange}
            onNotifyParentChange={handleNotifyParentChange}
            onNeedsMakeupChange={handleNeedsMakeupChange}
            onProgressChange={handleProgressChange}
            onProgressEntriesChange={handleProgressEntriesChange}
            onApplyProgressToAll={handleApplyProgressToAll}
            onMemoChange={handleMemoChange}
            onExamScoreChange={handleExamScoreChange}
            onSave={handleSave}
          />
        )}
      </div>
      
      {/* 옵션 피커 */}
      <FeedOptionPicker
        isOpen={optionPicker.isOpen}
        setName={optionPicker.setName || ''}
        options={optionPicker.options}
        currentValue={optionPicker.currentValue}
        anchorEl={optionPicker.anchorEl}
        onSelect={handleOptionSelect}
        onClose={closeOptionPicker}
      />
      
      {/* Dirty 상태 경고 */}
      {hasDirtyCards && !makeupPanelOpen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#F59E0B] text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-3 border border-[#D97706]">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>저장하지 않은 변경사항이 있습니다</span>
          </div>
        </div>
      )}
      
      {/* 모달들 */}
      <AddMemoModal
        isOpen={showAddMemo}
        value={newMemoName}
        onChange={setNewMemoName}
        onConfirm={handleAddMemoField}
        onClose={() => setShowAddMemo(false)}
      />
      
      <ScheduleModal
        isOpen={scheduleModal.open}
        studentName={scheduleModal.studentName}
        date={scheduleDate}
        hour={scheduleHour}
        minute={scheduleMinute}
        onDateChange={setScheduleDate}
        onHourChange={setScheduleHour}
        onMinuteChange={setScheduleMinute}
        onConfirm={handleScheduleConfirm}
        onClose={() => setScheduleModal({ open: false, ticketId: '', studentName: '' })}
      />
      
      <CancelModal
        isOpen={cancelModal.open}
        studentName={cancelModal.studentName}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={handleCancelConfirm}
        onClose={() => setCancelModal({ open: false, ticketId: '', studentName: '' })}
      />
    </div>
  );
}
