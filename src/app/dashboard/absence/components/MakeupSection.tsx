'use client';

import { useState } from 'react';
import { X, Calendar, Ban } from 'lucide-react';
import type { MakeupTicket, DateFilter, StatusFilter } from '../hooks/useMakeupTickets';
import { formatDateShort } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface MakeupSectionProps {
  tickets: MakeupTicket[];
  isLoading: boolean;
  processingId: string | null;
  noteInputs: Record<string, string>;
  stats: { pending: number; completed: number; cancelled: number };
  role?: 'owner' | 'teacher';

  // Filters
  statusFilter: StatusFilter;
  dateFilter: DateFilter;
  customStartDate: string;
  customEndDate: string;

  // Callbacks
  onStatusFilterChange: (filter: StatusFilter) => void;
  onDateFilterChange: (filter: DateFilter) => void;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onNoteChange: (ticketId: string, value: string) => void;
  onComplete: (ticketId: string) => void;
  onReopen: (ticketId: string) => void;
  onSchedule: (ticketId: string, date: string, time?: string) => void;
  onCancelWithReason: (ticketId: string, reason: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export default function MakeupSection({
  tickets,
  isLoading,
  processingId,
  noteInputs,
  stats,
  role = 'owner',
  statusFilter,
  dateFilter,
  customStartDate,
  customEndDate,
  onStatusFilterChange,
  onDateFilterChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onNoteChange,
  onComplete,
  onReopen,
  onSchedule,
  onCancelWithReason,
}: MakeupSectionProps) {
  // 모달 상태
  const [scheduleModal, setScheduleModal] = useState<{
    open: boolean;
    ticketId: string;
    studentName: string;
  }>({ open: false, ticketId: '', studentName: '' });
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleHour, setScheduleHour] = useState('');
  const [scheduleMinute, setScheduleMinute] = useState('');

  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    ticketId: string;
    studentName: string;
  }>({ open: false, ticketId: '', studentName: '' });
  const [cancelReason, setCancelReason] = useState('');

  const dateFilterTabs = [
    { value: 'today' as const, label: '오늘' },
    { value: 'week' as const, label: '이번주' },
    { value: 'month' as const, label: '이번달' },
    { value: 'custom' as const, label: '기간선택' },
  ];

  const statusFilterTabs = [
    { value: 'pending' as const, label: '대기중' },
    { value: 'completed' as const, label: '완료' },
    { value: 'cancelled' as const, label: '취소' },
    { value: 'all' as const, label: '전체' },
  ];

  // 모달 핸들러
  function openScheduleModal(ticketId: string, studentName: string) {
    setScheduleModal({ open: true, ticketId, studentName });
    setScheduleDate('');
    setScheduleHour('');
    setScheduleMinute('');
  }

  function closeScheduleModal() {
    setScheduleModal({ open: false, ticketId: '', studentName: '' });
  }

  function handleScheduleSubmit() {
    if (!scheduleDate) return;
    const time = scheduleHour && scheduleMinute ? `${scheduleHour}:${scheduleMinute}:00` : undefined;
    onSchedule(scheduleModal.ticketId, scheduleDate, time);
    closeScheduleModal();
  }

  function openCancelModal(ticketId: string, studentName: string) {
    setCancelModal({ open: true, ticketId, studentName });
    setCancelReason('');
  }

  function closeCancelModal() {
    setCancelModal({ open: false, ticketId: '', studentName: '' });
  }

  function handleCancelSubmit() {
    if (!cancelReason.trim()) return;
    onCancelWithReason(cancelModal.ticketId, cancelReason);
    closeCancelModal();
  }

  // 시간 포맷
  function formatTime(time: string | null) {
    if (!time) return '';
    return time.slice(0, 5);
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E7EB] bg-[#FEF3C7]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#92400E] flex items-center gap-2">
              📅 보강 관리
            </h2>
            <span className="text-sm text-[#92400E]">{tickets.length}건</span>
          </div>

          {/* 날짜 필터 탭 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {dateFilterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onDateFilterChange(tab.value)}
                className={`
                  px-3 py-1 rounded-lg text-xs font-medium transition-colors
                  ${
                    dateFilter === tab.value
                      ? 'bg-[#F59E0B] text-white'
                      : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 기간 선택 입력 */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
              />
              <span className="text-sm text-[#6B7280]">~</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
              />
            </div>
          )}

          {/* 상태 필터 탭 */}
          <div className="flex gap-2 mt-2">
            {statusFilterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onStatusFilterChange(tab.value)}
                className={`
                  px-3 py-1 rounded-lg text-xs font-medium transition-colors
                  ${
                    statusFilter === tab.value
                      ? 'bg-[#6366F1] text-white'
                      : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-3 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-sm text-[#6B7280]">로딩중...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✓</div>
              <p className="text-[#6B7280]">
                {statusFilter === 'pending' ? '대기중인 보강이 없습니다' : '보강 내역이 없습니다'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-[#1F2937]">
                          {ticket.studentName}
                        </span>
                        {ticket.status === 'pending' ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FEF3C7] text-[#92400E]">
                            대기
                          </span>
                        ) : ticket.status === 'completed' ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#D1FAE5] text-[#065F46]">
                            완료
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#E5E7EB] text-[#6B7280]">
                            취소
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#6B7280]">
                        <span>{ticket.className}</span>
                        <span className="mx-1">·</span>
                        <span>{formatDateShort(ticket.absenceDate)} 결석</span>
                        {ticket.absenceReason && (
                          <>
                            <span className="mx-1">·</span>
                            <span>{ticket.absenceReason}</span>
                          </>
                        )}
                      </div>
                      
                      {/* 예약된 날짜 표시 */}
                      {ticket.scheduledDate && ticket.status === 'pending' && (
                        <p className="text-sm text-[#6366F1] font-medium mt-1">
                          📅 {formatDateShort(ticket.scheduledDate)} 
                          {ticket.scheduledTime && ` ${formatTime(ticket.scheduledTime)}`} 예정
                        </p>
                      )}
                      
                      {/* 완료 노트 */}
                      {ticket.completionNote && (
                        <p className="text-sm text-[#059669] font-medium mt-1">
                          ✓ {ticket.completionNote}
                        </p>
                      )}
                      
                      {/* 취소 사유 */}
                      {ticket.cancelReason && ticket.status === 'cancelled' && (
                        <p className="text-sm text-[#6B7280] mt-1">
                          사유: {ticket.cancelReason}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0">
                      {ticket.status === 'pending' && role === 'owner' ? (
                        <div className="flex flex-col gap-2">
                          {/* 날짜 예약 버튼 */}
                          <button
                            onClick={() => openScheduleModal(ticket.id, ticket.studentName)}
                            disabled={processingId === ticket.id}
                            className="px-3 py-1.5 text-xs font-medium text-[#6366F1] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {ticket.scheduledDate ? '날짜변경' : '날짜예약'}
                          </button>
                          
                          {/* 보강 안함 */}
                          <button
                            onClick={() => openCancelModal(ticket.id, ticket.studentName)}
                            disabled={processingId === ticket.id}
                            className="px-3 py-1.5 text-xs font-medium text-[#9CA3AF] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg transition-colors disabled:opacity-50"
                          >
                            보강안함
                          </button>
                          
                          {/* 완료 처리 */}
                          <button
                            onClick={() => onComplete(ticket.id)}
                            disabled={processingId === ticket.id}
                            className="px-3 py-1.5 text-xs font-medium bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {processingId === ticket.id ? '처리중...' : '완료'}
                          </button>
                        </div>
                      ) : (ticket.status === 'completed' || ticket.status === 'cancelled') && role === 'owner' ? (
                        <button
                          onClick={() => onReopen(ticket.id)}
                          disabled={processingId === ticket.id}
                          className="px-2 py-1 text-xs text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                        >
                          되돌리기
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        {!isLoading && (
          <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
            <div className="flex justify-around text-center text-sm">
              <div>
                <p className="font-bold text-[#F59E0B]">{stats.pending}</p>
                <p className="text-[#6B7280]">대기</p>
              </div>
              <div>
                <p className="font-bold text-[#10B981]">{stats.completed}</p>
                <p className="text-[#6B7280]">완료</p>
              </div>
              <div>
                <p className="font-bold text-[#6B7280]">{stats.cancelled}</p>
                <p className="text-[#6B7280]">취소</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 날짜 예약 모달 */}
      {scheduleModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">
                보강 날짜 예약
              </h2>
              <button
                onClick={closeScheduleModal}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-[#6B7280]">
                <span className="font-medium text-[#111827]">{scheduleModal.studentName}</span> 학생의 보강 날짜를 예약합니다.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  날짜 *
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  시간 (선택)
                </label>
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
                onClick={closeScheduleModal}
                className="flex-1 px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleScheduleSubmit}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">
                보강 안함 처리
              </h2>
              <button
                onClick={closeCancelModal}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm text-[#6B7280]">
                <span className="font-medium text-[#111827]">{cancelModal.studentName}</span> 학생의 보강을 취소합니다.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  사유 *
                </label>
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
                onClick={closeCancelModal}
                className="flex-1 px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={!cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] disabled:opacity-50 transition-colors"
              >
                보강 안함
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
