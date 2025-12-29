'use client';

import type { MakeupTicket, DateFilter, StatusFilter } from '../hooks/useMakeupTickets';

// ============================================================================
// Types
// ============================================================================

interface MakeupSectionProps {
  tickets: MakeupTicket[];
  isLoading: boolean;
  processingId: string | null;
  noteInputs: Record<string, string>;
  stats: { pending: number; completed: number; cancelled: number };

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
}

// ============================================================================
// Helper
// ============================================================================

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];
  return `${month}/${day} (${dayOfWeek})`;
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
}: MakeupSectionProps) {
  const dateFilterTabs = [
    { value: 'today' as const, label: '오늘' },
    { value: 'week' as const, label: '이번주' },
    { value: 'month' as const, label: '이번달' },
    { value: 'custom' as const, label: '기간선택' },
  ];

  const statusFilterTabs = [
    { value: 'pending' as const, label: '대기중' },
    { value: 'completed' as const, label: '완료' },
    { value: 'all' as const, label: '전체' },
  ];

  return (
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
                      <span>{formatDate(ticket.absenceDate)} 결석</span>
                      {ticket.absenceReason && (
                        <>
                          <span className="mx-1">·</span>
                          <span>{ticket.absenceReason}</span>
                        </>
                      )}
                    </div>
                    {ticket.completionNote && (
                      <p className="text-sm text-[#059669] font-medium mt-1">
                        ✓ {ticket.completionNote}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    {ticket.status === 'pending' ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="예: 12/28 보강완료"
                          value={noteInputs[ticket.id] || ''}
                          onChange={(e) => onNoteChange(ticket.id, e.target.value)}
                          className="w-36 px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                        />
                        <button
                          onClick={() => onComplete(ticket.id)}
                          disabled={processingId === ticket.id}
                          className="px-3 py-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {processingId === ticket.id ? '처리중...' : '완료'}
                        </button>
                      </div>
                    ) : ticket.status === 'completed' ? (
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
  );
}
