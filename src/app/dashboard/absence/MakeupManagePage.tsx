'use client';

import { useAbsents } from './hooks/useAbsents';
import { useMakeupTickets } from './hooks/useMakeupTickets';
import AbsentsSection from './components/AbsentsSection';
import MakeupSection from './components/MakeupSection';

// ============================================================================
// Main Component
// ============================================================================

export default function MakeupManagePage() {
  // Hooks
  const absents = useAbsents();
  const makeup = useMakeupTickets();

  return (
    <div className="min-h-screen bg-[#F7F6F3] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">결석·보강 관리</h1>
          <p className="text-sm text-[#6B7280] mt-1">결석 현황과 보강 처리를 한눈에</p>
        </div>

        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 결석자 목록 */}
          <AbsentsSection
            absents={absents.absents}
            isLoading={absents.isLoading}
            dateFilter={absents.dateFilter}
            customStartDate={absents.customStartDate}
            customEndDate={absents.customEndDate}
            onDateFilterChange={absents.setDateFilter}
            onCustomStartDateChange={absents.setCustomStartDate}
            onCustomEndDateChange={absents.setCustomEndDate}
          />

          {/* 오른쪽: 보강 관리 */}
          <MakeupSection
            tickets={makeup.tickets}
            isLoading={makeup.isLoading}
            processingId={makeup.processingId}
            noteInputs={makeup.noteInputs}
            stats={makeup.stats}
            statusFilter={makeup.statusFilter}
            dateFilter={makeup.dateFilter}
            customStartDate={makeup.customStartDate}
            customEndDate={makeup.customEndDate}
            onStatusFilterChange={makeup.setStatusFilter}
            onDateFilterChange={makeup.setDateFilter}
            onCustomStartDateChange={makeup.setCustomStartDate}
            onCustomEndDateChange={makeup.setCustomEndDate}
            onNoteChange={makeup.updateNoteInput}
            onComplete={makeup.handleComplete}
            onReopen={makeup.handleReopen}
          />
        </div>
      </div>
    </div>
  );
}
