'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import StudentCard from './components/StudentCard';
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
} from './components';
import { 
  FeedOption, 
  AttendanceStatus, 
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
  // 정적 데이터
  initialClasses: { id: string; name: string; color?: string }[];
  initialOptionSets: FeedOptionSet[];
  initialExamTypes: ExamType[];
  initialTextbooks: Textbook[];
  initialTenantSettings: TenantSettings;
  // 동적 데이터
  initialClassId: string;
  initialDate: string;
  initialStudents: ClassStudent[];
  initialSavedFeeds: Record<string, SavedFeedData>;
  initialPreviousProgressMap: Record<string, string>;
  initialPreviousProgressEntriesMap: Record<string, ProgressEntry[]>;
  // 사용자 정보
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
  
  // 옵션 피커 상태
  const [optionPicker, setOptionPicker] = useState<{
    isOpen: boolean;
    studentId: string | null;
    setId: string | null;
    setName: string | null;
    options: FeedOption[];
    currentValue: string | null;
    anchorEl: HTMLElement | null;
  }>({
    isOpen: false,
    studentId: null,
    setId: null,
    setName: null,
    options: [],
    currentValue: null,
    anchorEl: null,
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
  // 핸들러
  // ============================================================================
  
  const openOptionPicker = useCallback((studentId: string, setId: string, anchorEl: HTMLElement) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    const cardData = cardDataMap[studentId];
    const currentValue = cardData?.feedValues[setId] || null;
    
    setOptionPicker({
      isOpen: true,
      studentId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
      anchorEl,
    });
  }, [optionSets, cardDataMap]);
  
  const closeOptionPicker = useCallback(() => {
    setOptionPicker(prev => ({ ...prev, isOpen: false, anchorEl: null }));
  }, []);
  
  const handleOptionSelect = useCallback((optionId: string) => {
    if (optionPicker.studentId && optionPicker.setId) {
      if (makeupPanelOpen) {
        handleMakeupFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
      } else {
        handleFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
      }
    }
  }, [optionPicker, makeupPanelOpen, handleFeedValueChange, handleMakeupFeedValueChange]);
  
  const handleAddMemoField = useCallback(() => {
    if (newMemoName.trim()) {
      addMemoField(newMemoName.trim());
      setNewMemoName('');
      setShowAddMemo(false);
    }
  }, [newMemoName, addMemoField]);
  
  const formatAbsenceDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  
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
  
  const openMakeupOptionPicker = useCallback((ticketId: string, setId: string, anchorEl: HTMLElement) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    const cardData = makeupCardDataMap[ticketId];
    const currentValue = cardData?.feedValues[setId] || null;
    
    setOptionPicker({
      isOpen: true,
      studentId: ticketId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
      anchorEl,
    });
  }, [optionSets, makeupCardDataMap]);
  
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
      
      {/* 보강 모달 - 별도 컴포넌트로 분리 가능하지만 복잡해서 일단 유지 */}
      {makeupPanelOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={handleCloseMakeupModal} />
          <div className="fixed inset-4 md:inset-10 lg:inset-16 bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <h2 className="text-xl font-bold text-[#1F2937]">보강 수업 입력</h2>
                {makeupDirtyCount > 0 && (
                  <span className="px-2 py-0.5 bg-[#6366F1] text-white text-xs rounded-full">
                    {makeupDirtyCount}명 미저장
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {makeupDirtyCount > 0 && (
                  <button
                    onClick={handleSaveMakeupAndClose}
                    className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    전체 저장 후 닫기
                  </button>
                )}
                <button onClick={handleCloseMakeupModal} className="p-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 바디 */}
            <div className="flex-1 overflow-auto p-6">
              <div className="grid lg:grid-cols-3 gap-6">
                {/* 왼쪽: 보강 대기 목록 */}
                <div className="lg:col-span-1">
                  <div className="bg-[#F9FAFB] rounded-xl p-4 sticky top-0">
                    <h3 className="font-semibold text-[#1F2937] mb-3">보강 대기 학생</h3>
                    <input
                      type="text"
                      value={makeupSearchQuery}
                      onChange={(e) => setMakeupSearchQuery(e.target.value)}
                      placeholder="학생 검색..."
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                    />
                    <div className="space-y-2 max-h-[60vh] overflow-auto">
                      {isLoadingMakeupTickets ? (
                        <div className="text-center py-8 text-[#9CA3AF]">
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#7C3AED] border-t-transparent mx-auto mb-2" />
                          불러오는 중...
                        </div>
                      ) : pendingMakeupTickets.length === 0 ? (
                        <div className="text-center py-8 text-[#9CA3AF]">
                          보강 대기 학생이 없습니다
                        </div>
                      ) : (
                        pendingMakeupTickets
                          .filter(ticket => !makeupSearchQuery || ticket.studentName.includes(makeupSearchQuery) || ticket.className.includes(makeupSearchQuery))
                          .map(ticket => {
                            const isAdded = addedTicketIds.includes(ticket.id);
                            const isProcessing = processingTicketId === ticket.id;
                            return (
                              <div key={ticket.id} className={`p-3 rounded-lg transition-all ${isAdded ? 'bg-[#7C3AED]/10 border-2 border-[#7C3AED]' : 'bg-white border border-[#E5E7EB]'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-[#1F2937]">{ticket.studentName}</span>
                                  <span className="text-xs text-[#6B7280]">{ticket.className}</span>
                                </div>
                                <div className="text-xs text-[#9CA3AF] mb-2">
                                  {formatAbsenceDate(ticket.absenceDate)} 결석 · {ticket.absenceReason}
                                </div>
                                {ticket.scheduledDate && (
                                  <div className="text-xs text-[#6366F1] mb-2">
                                    📅 {formatAbsenceDate(ticket.scheduledDate)} {ticket.scheduledTime?.slice(0, 5) || ''} 예정
                                  </div>
                                )}
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => !isAdded && handleAddMakeupStudent(ticket)}
                                    disabled={isAdded || isProcessing}
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${isAdded ? 'bg-[#7C3AED] text-white cursor-default' : 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20'} disabled:opacity-50`}
                                  >
                                    {isAdded ? '추가됨' : '보강입력'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setScheduleModal({ open: true, ticketId: ticket.id, studentName: ticket.studentName });
                                      setScheduleDate(ticket.scheduledDate || '');
                                      if (ticket.scheduledTime) {
                                        const [h, m] = ticket.scheduledTime.split(':');
                                        setScheduleHour(h);
                                        setScheduleMinute(m);
                                      } else {
                                        setScheduleHour('');
                                        setScheduleMinute('');
                                      }
                                    }}
                                    disabled={isProcessing}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium text-[#6366F1] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    날짜예약
                                  </button>
                                  <button
                                    onClick={() => {
                                      setCancelModal({ open: true, ticketId: ticket.id, studentName: ticket.studentName });
                                      setCancelReason('');
                                    }}
                                    disabled={isProcessing}
                                    className="flex-1 px-2 py-1.5 text-xs font-medium text-[#9CA3AF] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    보강안함
                                  </button>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 오른쪽: 추가된 보강생 카드들 */}
                <div className="lg:col-span-2">
                  {addedTicketIds.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-10 text-center">
                      <div className="text-[#9CA3AF]">
                        <p className="text-lg mb-2">왼쪽에서 보강 학생을 선택하세요</p>
                        <p className="text-sm">선택한 학생의 피드 카드가 여기에 표시됩니다</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {addedTicketIds.map(ticketId => {
                        const cardData = makeupCardDataMap[ticketId];
                        if (!cardData) return null;
                        
                        return (
                          <div 
                            key={ticketId}
                            className={`bg-white rounded-xl border-2 p-4 transition-all ${cardData.status === 'saved' ? 'border-[#10B981] bg-[#F0FDF4]' : cardData.isDirty ? 'border-[#6366F1]' : 'border-[#E5E7EB]'}`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#1F2937]">{cardData.studentName}</span>
                                <span className="text-xs px-2 py-0.5 bg-[#7C3AED] text-white rounded">보강</span>
                              </div>
                              {cardData.status === 'saved' && <span className="text-[#10B981]">●</span>}
                            </div>
                            
                            <div className="mb-3">
                              <label className="text-xs text-[#6B7280] block mb-1">출결</label>
                              <select
                                value={cardData.attendanceStatus}
                                onChange={(e) => handleMakeupAttendanceChange(ticketId, e.target.value as AttendanceStatus)}
                                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm"
                              >
                                <option value="present">출석</option>
                                <option value="late">지각</option>
                                <option value="absent">결석</option>
                              </select>
                            </div>
                            
                            {tenantSettings.progress_enabled && cardData.attendanceStatus !== 'absent' && (
                              <div className="mb-3">
                                <label className="text-xs text-[#6B7280] block mb-1">진도</label>
                                <input
                                  type="text"
                                  value={cardData.progressText || ''}
                                  onChange={(e) => handleMakeupProgressChange(ticketId, e.target.value)}
                                  placeholder="진도 입력"
                                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm"
                                />
                              </div>
                            )}
                            
                            {cardData.attendanceStatus !== 'absent' && optionSets.map(set => (
                              <div key={set.id} className="mb-3">
                                <label className="text-xs text-[#6B7280] block mb-1">
                                  {set.name}{set.is_required && <span className="text-red-500">*</span>}
                                </label>
                                <button
                                  onClick={(e) => openMakeupOptionPicker(ticketId, set.id, e.currentTarget)}
                                  className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${cardData.feedValues[set.id] ? 'bg-[#10B981] text-white' : 'bg-[#FEE2E2] text-[#DC2626]'}`}
                                >
                                  {cardData.feedValues[set.id] ? set.options.find(o => o.id === cardData.feedValues[set.id])?.label || '선택' : '선택'}
                                </button>
                              </div>
                            ))}
                            
                            {memoFields.map(field => (
                              <div key={field.id} className="mb-3">
                                <label className="text-xs text-[#6B7280] block mb-1">{field.name}</label>
                                <input
                                  type="text"
                                  value={cardData.memoValues?.[field.id] || ''}
                                  onChange={(e) => handleMakeupMemoChange(ticketId, field.id, e.target.value)}
                                  placeholder={`${field.name} 입력`}
                                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm"
                                />
                              </div>
                            ))}
                            
                            <button
                              onClick={() => handleMakeupSave(ticketId)}
                              disabled={isSaving || (!cardData.isDirty && cardData.status !== 'dirty')}
                              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${cardData.status === 'saved' ? 'bg-[#D1FAE5] text-[#10B981]' : cardData.isDirty || cardData.status === 'dirty' ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}
                            >
                              {savingStudentId === ticketId ? '저장 중...' : cardData.status === 'saved' ? '✓ 저장됨' : '저장'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
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
