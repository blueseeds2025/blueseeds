'use client';

import type { AbsentStudent, DateFilter } from '../hooks/useAbsents';

// ============================================================================
// Types
// ============================================================================

interface AbsentsSectionProps {
  absents: AbsentStudent[];
  isLoading: boolean;
  dateFilter: DateFilter;
  customStartDate: string;
  customEndDate: string;
  onDateFilterChange: (filter: DateFilter) => void;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
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

export default function AbsentsSection({
  absents,
  isLoading,
  dateFilter,
  customStartDate,
  customEndDate,
  onDateFilterChange,
  onCustomStartDateChange,
  onCustomEndDateChange,
}: AbsentsSectionProps) {
  const dateFilterTabs = [
    { value: 'today' as const, label: '오늘' },
    { value: 'week' as const, label: '이번주' },
    { value: 'month' as const, label: '이번달' },
    { value: 'custom' as const, label: '기간선택' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E7EB] bg-[#FEE2E2]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[#991B1B] flex items-center gap-2">
            🚫 결석자 현황
          </h2>
          <span className="text-sm text-[#991B1B]">{absents.length}명</span>
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
                    ? 'bg-[#EF4444] text-white'
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
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => onCustomStartDateChange(e.target.value)}
              className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
            />
            <span className="text-sm text-[#6B7280]">~</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-[#EF4444] border-t-transparent rounded-full animate-spin" />
            <p className="mt-2 text-sm text-[#6B7280]">로딩중...</p>
          </div>
        ) : absents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✓</div>
            <p className="text-[#6B7280]">결석자가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {absents.map((student) => (
              <div
                key={student.id}
                className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-[#1F2937]">
                        {student.studentName}
                      </span>
                      {student.needsMakeup && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FEF3C7] text-[#92400E]">
                          보강필요
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[#6B7280]">
                      <span>{student.className}</span>
                      <span className="mx-1">·</span>
                      <span>{formatDate(student.feedDate)}</span>
                      {student.absenceReason && (
                        <>
                          <span className="mx-1">·</span>
                          <span>{student.absenceReason}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#9CA3AF]">이번달</span>
                    <p className="font-bold text-[#EF4444]">
                      {student.monthlyAbsenceCount}회
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {!isLoading && absents.length > 0 && (
        <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
          <div className="flex justify-around text-center text-sm">
            <div>
              <p className="font-bold text-[#EF4444]">
                {absents.filter((a) => a.needsMakeup).length}
              </p>
              <p className="text-[#6B7280]">보강필요</p>
            </div>
            <div>
              <p className="font-bold text-[#6B7280]">
                {absents.filter((a) => !a.needsMakeup).length}
              </p>
              <p className="text-[#6B7280]">보강불필요</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
