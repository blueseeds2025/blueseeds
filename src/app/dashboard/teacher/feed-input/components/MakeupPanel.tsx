'use client';

import { memo, useCallback, useState } from 'react';
import {
  StudentCardData,
  FeedOptionSet,
  TenantSettings,
  AttendanceStatus,
} from '../types';

// ============================================================================
// Types
// ============================================================================

interface MakeupTicket {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  absenceDate: string;
  absenceReason: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
}

interface MemoField {
  id: string;
  name: string;
}

interface MakeupPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // 티켓 목록
  tickets: MakeupTicket[];
  isLoadingTickets: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // 추가된 티켓
  addedTicketIds: string[];
  onAddTicket: (ticket: MakeupTicket) => void;
  // 카드 데이터
  cardDataMap: Record<string, StudentCardData>;
  optionSets: FeedOptionSet[];
  tenantSettings: TenantSettings;
  memoFields: MemoField[];
  // 핸들러
  onAttendanceChange: (ticketId: string, status: AttendanceStatus) => void;
  onProgressChange: (ticketId: string, text: string) => void;
  onMemoChange: (ticketId: string, key: string, value: string) => void;
  onOpenOptionPicker: (ticketId: string, setId: string, anchorEl: HTMLElement, currentValue: string | null) => void;
  onSave: (ticketId: string) => void;
  onSaveAll: () => void;
  // 티켓 처리
  onScheduleTicket: (ticketId: string, studentName: string, currentDate?: string | null, currentTime?: string | null) => void;
  onCancelTicket: (ticketId: string, studentName: string) => void;
  processingTicketId: string | null;
  // 상태
  dirtyCount: number;
  isSaving: boolean;
  savingStudentId: string | null;
}

// ============================================================================
// Component
// ============================================================================

export const MakeupPanel = memo(function MakeupPanel({
  isOpen,
  onClose,
  tickets,
  isLoadingTickets,
  searchQuery,
  onSearchChange,
  addedTicketIds,
  onAddTicket,
  cardDataMap,
  optionSets,
  tenantSettings,
  memoFields,
  onAttendanceChange,
  onProgressChange,
  onMemoChange,
  onOpenOptionPicker,
  onSave,
  onSaveAll,
  onScheduleTicket,
  onCancelTicket,
  processingTicketId,
  dirtyCount,
  isSaving,
  savingStudentId,
}: MakeupPanelProps) {
  if (!isOpen) return null;

  const formatAbsenceDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const filteredTickets = tickets.filter(ticket => 
    !searchQuery || 
    ticket.studentName.includes(searchQuery) || 
    ticket.className.includes(searchQuery)
  );

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      
      {/* 모달 */}
      <div className="fixed inset-4 md:inset-10 lg:inset-16 bg-white rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h2 className="text-xl font-bold text-[#1F2937]">보강 수업 입력</h2>
            {dirtyCount > 0 && (
              <span className="px-2 py-0.5 bg-[#6366F1] text-white text-xs rounded-full">
                {dirtyCount}명 미저장
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <button
                onClick={onSaveAll}
                className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-sm font-medium transition-colors"
              >
                전체 저장 후 닫기
              </button>
            )}
            <button onClick={onClose} className="p-2 text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors">
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
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="학생 검색..."
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                />
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {isLoadingTickets ? (
                    <div className="text-center py-8 text-[#9CA3AF]">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#7C3AED] border-t-transparent mx-auto mb-2" />
                      불러오는 중...
                    </div>
                  ) : filteredTickets.length === 0 ? (
                    <div className="text-center py-8 text-[#9CA3AF]">
                      보강 대기 학생이 없습니다
                    </div>
                  ) : (
                    filteredTickets.map(ticket => {
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
                              onClick={() => !isAdded && onAddTicket(ticket)}
                              disabled={isAdded || isProcessing}
                              className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${isAdded ? 'bg-[#7C3AED] text-white cursor-default' : 'bg-[#7C3AED]/10 text-[#7C3AED] hover:bg-[#7C3AED]/20'} disabled:opacity-50`}
                            >
                              {isAdded ? '추가됨' : '보강입력'}
                            </button>
                            <button
                              onClick={() => onScheduleTicket(ticket.id, ticket.studentName, ticket.scheduledDate, ticket.scheduledTime)}
                              disabled={isProcessing}
                              className="flex-1 px-2 py-1.5 text-xs font-medium text-[#6366F1] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 rounded-lg transition-colors disabled:opacity-50"
                            >
                              날짜예약
                            </button>
                            <button
                              onClick={() => onCancelTicket(ticket.id, ticket.studentName)}
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
                    const cardData = cardDataMap[ticketId];
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
                            onChange={(e) => onAttendanceChange(ticketId, e.target.value as AttendanceStatus)}
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
                              onChange={(e) => onProgressChange(ticketId, e.target.value)}
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
                              onClick={(e) => onOpenOptionPicker(ticketId, set.id, e.currentTarget, cardData.feedValues[set.id] || null)}
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
                              onChange={(e) => onMemoChange(ticketId, field.id, e.target.value)}
                              placeholder={`${field.name} 입력`}
                              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm"
                            />
                          </div>
                        ))}
                        
                        <button
                          onClick={() => onSave(ticketId)}
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
  );
});
