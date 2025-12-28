'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import StudentCard from './components/StudentCard';
import FeedOptionPicker from './components/FeedOptionPicker';
import { useFeedInput } from './hooks/useFeedInput';
import { formatDisplayDate, getGridClass, calculateGridColumns } from './constants';
import { FeedOption, AttendanceStatus } from './types';

interface FeedInputClientProps {
  initialClasses: { id: string; name: string }[];
  teacherId: string;
  tenantId: string;
}

export default function FeedInputClient({
  initialClasses,
  teacherId,
  tenantId,
}: FeedInputClientProps) {
  const classes = initialClasses || [];
  
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
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
  
  const {
    students,
    cardDataMap,
    optionSets,
    tenantSettings,
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
    handleMemoChange,
    handleFeedValueChange,
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
  } = useFeedInput({
    classId: selectedClassId,
    date: selectedDate,
    teacherId,
    tenantId,
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
          
          {/* 추가된 메모 필드 태그들 */}
          {memoFields.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[#E5E7EB]">
              <span className="text-xs text-[#6B7280]">메모 항목:</span>
              {memoFields.map((field, idx) => (
                <span 
                  key={field.id} 
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    ${idx === 0 
                      ? 'bg-[#F3F4F6] text-[#6B7280]' 
                      : 'bg-[#EEF2FF] text-[#6366F1]'
                    }
                  `}
                >
                  {field.name}
                  {idx > 0 && (
                    <button
                      onClick={() => removeMemoField(field.id)}
                      className="ml-1.5 text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 메모 추가 모달 */}
      {showAddMemo && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowAddMemo(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-lg text-[#1F2937] mb-4">메모 항목 추가</h3>
            <input
              type="text"
              placeholder="항목 이름 (예: 준비물, 알림장)"
              value={newMemoName}
              onChange={(e) => setNewMemoName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemoField()}
              autoFocus
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg mb-4 text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddMemo(false)}
                className="flex-1 px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#1F2937] rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddMemoField}
                disabled={!newMemoName.trim()}
                className="flex-1 px-4 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* 보강 전체화면 모달 */}
      {makeupPanelOpen && (
        <>
          {/* 블러 배경 */}
          <div 
            className="fixed inset-0 z-40 bg-white/60 backdrop-blur-sm"
            onClick={handleCloseMakeupModal}
          />
          
          {/* 모달 본체 */}
          <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 bg-[#F7F6F3] rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden flex flex-col">
          {/* 헤더 */}
          <div className="flex-shrink-0 bg-white border-b border-[#E5E7EB]">
            <div className="px-4 md:px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-[#1F2937] flex items-center gap-2">
                    <span>📋</span>
                    보강 수업
                  </h1>
                  <span className="text-sm text-[#6B7280]">
                    {formatDisplayDate(new Date(selectedDate))}
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* 저장 버튼 */}
                  <button
                    onClick={handleSaveMakeupAndClose}
                    disabled={isSaving || makeupDirtyCount === 0}
                    className={`
                      px-6 py-2 rounded-lg font-medium transition-all
                      ${makeupDirtyCount > 0
                        ? 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white'
                        : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                      }
                    `}
                  >
                    {isSaving ? '저장 중...' : `저장 ${makeupDirtyCount > 0 ? `(${makeupDirtyCount})` : ''}`}
                  </button>
                  
                  {/* 닫기 버튼 */}
                  <button
                    onClick={handleCloseMakeupModal}
                    className="p-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* 컨텐츠 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 왼쪽: 보강 대기 목록 */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <h2 className="font-semibold text-[#1F2937]">보강 대기 학생</h2>
                  </div>
                  
                  {/* 검색 */}
                  <div className="p-3 border-b border-[#E5E7EB]">
                    <input
                      type="text"
                      placeholder="학생 이름 검색..."
                      value={makeupSearchQuery}
                      onChange={(e) => setMakeupSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                    />
                  </div>
                  
                  {/* 목록 */}
                  <div className="max-h-[400px] overflow-y-auto">
                    {isLoadingMakeupTickets ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#7C3AED] border-t-transparent" />
                      </div>
                    ) : pendingMakeupTickets.length === 0 ? (
                      <div className="text-center py-10 text-[#9CA3AF]">
                        {makeupSearchQuery ? '검색 결과가 없습니다' : '보강 대기 학생이 없습니다'}
                      </div>
                    ) : (
                      <ul className="divide-y divide-[#F3F4F6]">
                        {pendingMakeupTickets.map(ticket => {
                          const isAdded = addedTicketIds.includes(ticket.id);
                          return (
                            <li key={ticket.id}>
                              <button
                                onClick={() => !isAdded && handleAddMakeupStudent(ticket)}
                                disabled={isAdded}
                                className={`
                                  w-full px-4 py-3 text-left transition-colors
                                  ${isAdded 
                                    ? 'bg-[#F3F4F6] cursor-not-allowed' 
                                    : 'hover:bg-[#FAF5FF]'
                                  }
                                `}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className={`font-medium ${isAdded ? 'text-[#9CA3AF]' : 'text-[#1F2937]'}`}>
                                      {ticket.studentName}
                                    </span>
                                    <span className="text-[#9CA3AF] text-sm ml-2">
                                      ({ticket.className} · {ticket.displayCode})
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    {isAdded ? (
                                      <span className="text-xs text-[#7C3AED] font-medium">추가됨</span>
                                    ) : (
                                      <>
                                        <span className="text-sm text-[#6B7280]">{formatAbsenceDate(ticket.absenceDate)}</span>
                                        <span className="text-xs text-[#9CA3AF] ml-2">{ticket.absenceReason || '-'}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
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
                    tenantSettings={tenantSettings}
                    memoFields={memoFields}
                    onOpenOptionPicker={openOptionPicker}
                    onAttendanceChange={handleAttendanceChange}
                    onNotifyParentChange={handleNotifyParentChange}
                    onNeedsMakeupChange={handleNeedsMakeupChange}
                    onProgressChange={handleProgressChange}
                    onMemoChange={handleMemoChange}
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-[#F59E0B] text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>저장하지 않은 변경사항이 있습니다</span>
          </div>
        </div>
      )}
    </div>
  );
}
