'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import StudentCard from './components/StudentCard';
import FeedOptionPicker from './components/FeedOptionPicker';
import { useFeedInput } from './hooks/useFeedInput';
import { formatDisplayDate, getGridClass, calculateGridColumns } from './constants';
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
interface FeedInputClientProps {
  // 정적 데이터 (변하지 않음)
  initialClasses: { id: string; name: string; color?: string }[];
  initialOptionSets: FeedOptionSet[];
  initialExamTypes: ExamType[];
  initialTextbooks: Textbook[];
  initialTenantSettings: TenantSettings;
  // 동적 데이터 (초기값)
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

export default function FeedInputClient({
  // 정적 데이터
  initialClasses,
  initialOptionSets,
  initialExamTypes,
  initialTextbooks,
  initialTenantSettings,
  // 동적 데이터
  initialClassId,
  initialDate,
  initialStudents,
  initialSavedFeeds,
  initialPreviousProgressMap,
  initialPreviousProgressEntriesMap,
  // 사용자 정보
  teacherId,
  tenantId,
}: FeedInputClientProps) {
  const classes = initialClasses || [];
  
  // 🆕 today는 max용으로만 사용
  const today = new Date().toISOString().split('T')[0];
  // 🆕 서버에서 받은 초기값 사용
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [gridClass, setGridClass] = useState('grid-cols-3');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 메모 추가 모달
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [newMemoName, setNewMemoName] = useState('');
  
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
  
  // 보강 모달용 상태 (추가된 티켓 ID들)
  const [addedTicketIds, setAddedTicketIds] = useState<string[]>([]);
  
  // 날짜 예약 모달
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    ticketId: string;
    studentName: string;
    currentDate: string | null;
    currentTime: string | null;
  }>({ open: false, ticketId: '', studentName: '', currentDate: null, currentTime: null });
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');
  
  // 보강 안함 모달
  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    ticketId: string;
    studentName: string;
  }>({ open: false, ticketId: '', studentName: '' });
  const [cancelReason, setCancelReason] = useState('');
  
  const {
    students,
    cardDataMap,
    optionSets,
    examTypes,
    textbooks,  // 🆕 추가
    tenantSettings,
    previousProgressEntriesMap,  // 🆕 추가
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
    handleProgressEntriesChange,  // 🆕 추가
    handleApplyProgressToAll,  // 🆕 진도 반 전체 적용
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
    // 보강 전용 상태 및 핸들러
    makeupCardDataMap,
    handleMakeupAttendanceChange,
    handleMakeupProgressChange,
    handleMakeupMemoChange,
    handleMakeupFeedValueChange,
    handleMakeupSave,
    handleMakeupSaveAll,
    makeupDirtyCount,
    // 티켓 직접 처리
    handleScheduleTicket,
    handleCancelTicket,
    processingTicketId,
   } = useFeedInput({
    classId: selectedClassId,
    date: selectedDate,
    teacherId,
    tenantId,
    // 🆕 서버에서 받은 정적 데이터
    initialOptionSets,
    initialExamTypes,
    initialTextbooks,
    initialTenantSettings,
    // 🆕 서버에서 받은 동적 데이터
    initialStudents,
    initialSavedFeeds,
    initialPreviousProgressMap,
    initialPreviousProgressEntriesMap,
    // 🆕 서버에서 데이터 가져온 기준
    serverClassId: initialClassId,
    serverDate: initialDate,
  });
  
  // 그리드 컬럼 계산
  useEffect(() => {
    const updateGrid = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const columns = calculateGridColumns(students.length, width);
        setGridClass(getGridClass(columns));
      }
    };
    
    updateGrid();
    window.addEventListener('resize', updateGrid);
    return () => window.removeEventListener('resize', updateGrid);
  }, [students.length]);
  
  // 페이지 이탈 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirtyCards) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirtyCards]);
  
  // 옵션 피커 열기
  const openOptionPicker = (studentId: string, setId: string, anchorEl: HTMLElement) => {
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
  };
  
  // 옵션 피커 닫기
  const closeOptionPicker = () => {
    setOptionPicker(prev => ({ ...prev, isOpen: false, anchorEl: null }));
  };
  
  // 옵션 선택 (정규 피드용)
  const handleOptionSelect = (optionId: string) => {
    if (optionPicker.studentId && optionPicker.setId) {
      handleFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
    }
  };
  
  // 메모 필드 추가
  const handleAddMemoField = () => {
    if (newMemoName.trim()) {
      addMemoField(newMemoName.trim());
      setNewMemoName('');
      setShowAddMemo(false);
    }
  };
  
  // 날짜 포맷 (보강 목록용)
  const formatAbsenceDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  
  // 보강 모달에서 학생 추가
  const handleAddMakeupStudent = (ticket: Parameters<typeof addMakeupStudentFromTicket>[0]) => {
    addMakeupStudentFromTicket(ticket);
    setAddedTicketIds(prev => [...prev, ticket.id]);
  };
  
  // 보강 모달 닫기
  const handleCloseMakeupModal = () => {
    closeMakeupPanel();  // 훅에서 makeupCardDataMap 초기화
    setAddedTicketIds([]);
    setMakeupSearchQuery('');
  };
  
  // 보강 저장 후 모달 닫기 및 목록 새로고침
  const handleSaveMakeupAndClose = async () => {
    await handleMakeupSaveAll();
    // 저장 성공 시 목록 새로고침
    await loadPendingMakeupTickets();
    handleCloseMakeupModal();
  };
  
  // 보강 모달용 옵션 피커 열기
  const openMakeupOptionPicker = (ticketId: string, setId: string, anchorEl: HTMLElement) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    const cardData = makeupCardDataMap[ticketId];
    const currentValue = cardData?.feedValues[setId] || null;
    
    setOptionPicker({
      isOpen: true,
      studentId: ticketId,  // ticketId를 studentId 자리에 사용
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
      anchorEl,
    });
  };
  
  // 보강 모달용 옵션 선택
  const handleMakeupOptionSelect = (optionId: string) => {
    if (optionPicker.studentId && optionPicker.setId) {
      // studentId 자리에 ticketId가 들어있음
      handleMakeupFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
    }
  };
  
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
            
            {/* 보강 버튼 (makeup_system 기능 활성화 시만) */}
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
          
          {/* 메모 추가 모달 */}
          {showAddMemo && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-lg font-semibold text-[#1F2937] mb-4">메모 필드 추가</h3>
                <input
                  type="text"
                  value={newMemoName}
                  onChange={(e) => setNewMemoName(e.target.value)}
                  placeholder="메모 이름 (예: 숙제, 준비물)"
                  className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMemoField();
                    if (e.key === 'Escape') setShowAddMemo(false);
                  }}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAddMemo(false)}
                    className="px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddMemoField}
                    disabled={!newMemoName.trim()}
                    className="px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] disabled:opacity-50 transition-colors"
                  >
                    추가
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 보강 모달 */}
      {makeupPanelOpen && (
        <>
          {/* 배경 오버레이 */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleCloseMakeupModal}
          />
          
          {/* 모달 */}
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
                <button
                  onClick={handleCloseMakeupModal}
                  className="p-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                >
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
                  
                  {/* 검색 */}
                  <input
                    type="text"
                    value={makeupSearchQuery}
                    onChange={(e) => setMakeupSearchQuery(e.target.value)}
                    placeholder="학생 검색..."
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                  />
                  
                  {/* 목록 */}
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
                        .filter(ticket => 
                          !makeupSearchQuery || 
                          ticket.studentName.includes(makeupSearchQuery) ||
                          ticket.className.includes(makeupSearchQuery)
                        )
                        .map(ticket => {
                          const isAdded = addedTicketIds.includes(ticket.id);
                          const isProcessing = processingTicketId === ticket.id;
                          return (
                            <div
                              key={ticket.id}
                              className={`
                                p-3 rounded-lg transition-all
                                ${isAdded 
                                  ? 'bg-[#7C3AED]/10 border-2 border-[#7C3AED]'
                                  : 'bg-white border border-[#E5E7EB]'
                                }
                              `}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-[#1F2937]">{ticket.studentName}</span>
                                <span className="text-xs text-[#6B7280]">{ticket.className}</span>
                              </div>
                              <div className="text-xs text-[#9CA3AF] mb-2">
                                {formatAbsenceDate(ticket.absenceDate)} 결석 · {ticket.absenceReason}
                              </div>
                              
                              {/* 예약된 날짜 표시 */}
                              {ticket.scheduledDate && (
                                <div className="text-xs text-[#6366F1] mb-2">
                                  📅 {formatAbsenceDate(ticket.scheduledDate)} {ticket.scheduledTime?.slice(0, 5) || ''} 예정
                                </div>
                              )}
                              
                              {/* 버튼들 */}
                              <div className="flex gap-1">
                                <button
                                  onClick={() => !isAdded && handleAddMakeupStudent(ticket)}
                                  disabled={isAdded || isProcessing}
                                  className={`
                                    flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors
                                    ${isAdded
                                      ? 'bg-[#7C3AED] text-white cursor-default'
                                      : 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20'
                                    }
                                    disabled:opacity-50
                                  `}
                                >
                                  {isAdded ? '추가됨' : '보강입력'}
                                </button>
                                <button
                                  onClick={() => {
                                    setScheduleModal({
                                      open: true,
                                      ticketId: ticket.id,
                                      studentName: ticket.studentName,
                                      currentDate: ticket.scheduledDate,
                                      currentTime: ticket.scheduledTime,
                                    });
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
                                    setCancelModal({
                                      open: true,
                                      ticketId: ticket.id,
                                      studentName: ticket.studentName,
                                    });
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
                      
                      // 보강 카드는 간단한 인라인 UI 사용
                      return (
                        <div 
                          key={ticketId}
                          className={`
                            bg-white rounded-xl border-2 p-4 transition-all
                            ${cardData.status === 'saved' 
                              ? 'border-[#10B981] bg-[#F0FDF4]' 
                              : cardData.isDirty 
                                ? 'border-[#6366F1]' 
                                : 'border-[#E5E7EB]'
                            }
                          `}
                        >
                          {/* 헤더 */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#1F2937]">{cardData.studentName}</span>
                              <span className="text-xs px-2 py-0.5 bg-[#7C3AED] text-white rounded">보강</span>
                            </div>
                            {cardData.status === 'saved' && (
                              <span className="text-[#10B981]">●</span>
                            )}
                          </div>
                          
                          {/* 출결 */}
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
                          
                          {/* 진도 */}
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
                          
                          {/* 피드 옵션들 */}
                          {cardData.attendanceStatus !== 'absent' && optionSets.map(set => (
                            <div key={set.id} className="mb-3">
                              <label className="text-xs text-[#6B7280] block mb-1">
                                {set.name}
                                {set.is_required && <span className="text-red-500">*</span>}
                              </label>
                              <button
                                onClick={(e) => openMakeupOptionPicker(ticketId, set.id, e.currentTarget)}
                                className={`
                                  w-full px-3 py-2 rounded-lg text-sm text-left transition-colors
                                  ${cardData.feedValues[set.id]
                                    ? 'bg-[#10B981] text-white'
                                    : 'bg-[#FEE2E2] text-[#DC2626]'
                                  }
                                `}
                              >
                                {cardData.feedValues[set.id]
                                  ? set.options.find(o => o.id === cardData.feedValues[set.id])?.label || '선택'
                                  : '선택'
                                }
                              </button>
                            </div>
                          ))}
                          
                          {/* 메모 */}
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
                          
                          {/* 저장 버튼 */}
                          <button
                            onClick={() => handleMakeupSave(ticketId)}
                            disabled={isSaving || (!cardData.isDirty && cardData.status !== 'dirty')}
                            className={`
                              w-full py-2.5 rounded-lg font-medium text-sm transition-colors
                              ${cardData.status === 'saved'
                                ? 'bg-[#D1FAE5] text-[#10B981]'
                                : cardData.isDirty || cardData.status === 'dirty'
                                  ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                                  : 'bg-[#F3F4F6] text-[#9CA3AF]'
                              }
                            `}
                          >
                            {savingStudentId === ticketId 
                              ? '저장 중...' 
                              : cardData.status === 'saved' 
                                ? '✓ 저장됨' 
                                : '저장'
                            }
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
          <>
            {/* 학생 카드 그리드 */}
            <div className={`grid gap-3 ${gridClass}`}>
              {students.map(student => {
                const cardData = cardDataMap[student.id];
                if (!cardData) return null;
                
                return (
                  <StudentCard
                    key={student.id}
                    data={cardData}
                    optionSets={optionSets}
                    examTypes={examTypes}
                    textbooks={textbooks}  // 🆕 추가
                    previousProgressEntries={previousProgressEntriesMap[student.id] || []}  // 🆕 추가
                    tenantSettings={tenantSettings}
                    memoFields={memoFields}
                    onOpenOptionPicker={openOptionPicker}
                    onAttendanceChange={handleAttendanceChange}
                    onNotifyParentChange={handleNotifyParentChange}
                    onNeedsMakeupChange={handleNeedsMakeupChange}
                    onProgressChange={handleProgressChange}
                    onProgressEntriesChange={handleProgressEntriesChange}  // 🆕 추가
                    onApplyProgressToAll={students.length > 1 ? handleApplyProgressToAll : undefined}  // 🆕 2명 이상일 때만
                    onMemoChange={handleMemoChange}
                    onExamScoreChange={handleExamScoreChange}
                    onSave={handleSave}
                    isSaving={savingStudentId === student.id}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
      
      {/* 옵션 피커 (PC: 팝오버 / 모바일: 바텀시트) */}
      <FeedOptionPicker
        isOpen={optionPicker.isOpen}
        setName={optionPicker.setName || ''}
        options={optionPicker.options}
        currentValue={optionPicker.currentValue}
        anchorEl={optionPicker.anchorEl}
        onSelect={makeupPanelOpen ? handleMakeupOptionSelect : handleOptionSelect}
        onClose={closeOptionPicker}
      />
      
      {/* Dirty 상태 경고 (보강 모달 열려있을 땐 숨김) */}
      {hasDirtyCards && !makeupPanelOpen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#F59E0B] text-white px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-3 border border-[#D97706]">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>저장하지 않은 변경사항이 있습니다</span>
          </div>
        </div>
      )}
      
      {/* 날짜 예약 모달 */}
      {scheduleModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">보강 날짜 예약</h2>
              <button
                onClick={() => setScheduleModal({ open: false, ticketId: '', studentName: '', currentDate: null, currentTime: null })}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <svg className="w-5 h-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-[#6B7280]">
                <span className="font-medium text-[#111827]">{scheduleModal.studentName}</span> 학생의 보강 날짜를 예약합니다.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">날짜 *</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">시간 (선택)</label>
                <div className="flex gap-2">
                  <select
                    value={scheduleHour}
                    onChange={(e) => setScheduleHour(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  >
                    <option value="">시</option>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}시</option>
                    ))}
                  </select>
                  <select
                    value={scheduleMinute}
                    onChange={(e) => setScheduleMinute(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  >
                    <option value="">분</option>
                    {['00', '10', '20', '30', '40', '50'].map(m => (
                      <option key={m} value={m}>{m}분</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-[#E5E7EB] flex gap-2">
              <button
                onClick={() => setScheduleModal({ open: false, ticketId: '', studentName: '', currentDate: null, currentTime: null })}
                className="flex-1 px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  if (!scheduleDate) return;
                  const time = scheduleHour && scheduleMinute ? `${scheduleHour}:${scheduleMinute}:00` : undefined;
                  await handleScheduleTicket(scheduleModal.ticketId, scheduleDate, time);
                  setScheduleModal({ open: false, ticketId: '', studentName: '', currentDate: null, currentTime: null });
                }}
                disabled={!scheduleDate}
                className="flex-1 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] disabled:opacity-50 transition-colors"
              >
                예약
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 보강 안함 모달 */}
      {cancelModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">보강 안함 처리</h2>
              <button
                onClick={() => setCancelModal({ open: false, ticketId: '', studentName: '' })}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <svg className="w-5 h-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-[#6B7280]">
                <span className="font-medium text-[#111827]">{cancelModal.studentName}</span> 학생의 보강을 취소합니다.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">사유 *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="예: 학부모 요청으로 보강 불필요"
                  rows={3}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-[#E5E7EB] flex gap-2">
              <button
                onClick={() => setCancelModal({ open: false, ticketId: '', studentName: '' })}
                className="flex-1 px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                닫기
              </button>
              <button
                onClick={async () => {
                  if (!cancelReason.trim()) return;
                  await handleCancelTicket(cancelModal.ticketId, cancelReason);
                  setCancelModal({ open: false, ticketId: '', studentName: '' });
                }}
                disabled={!cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] disabled:opacity-50 transition-colors"
              >
                보강 안함
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
