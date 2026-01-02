// ============================================================================
// 리포트 카드 컴포넌트
// ============================================================================
'use client';

import type { MonthlyReportWithStudent } from '@/types/monthly-report.types';
import { STATUS_INFO, TEMPLATE_INFO } from '@/types/monthly-report.types';

interface ReportCardProps {
  report: MonthlyReportWithStudent;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ReportCard({ report, onEdit, onDelete }: ReportCardProps) {
  const statusInfo = STATUS_INFO[report.status];
  const templateInfo = TEMPLATE_INFO.find((t) => t.type === report.template_type);
  
  // 출석률 계산
  const attendanceRate = report.attendance_summary?.rate ?? 0;
  
  // 평균 점수 계산
  const scoreEntries = Object.entries(report.score_summary || {});
  const avgScore = scoreEntries.length > 0
    ? Math.round(scoreEntries.reduce((sum, [_, v]) => sum + (v.average || 0), 0) / scoreEntries.length)
    : null;
  
  // 상태별 색상
  const statusColors: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-600',
    generated: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-amber-100 text-amber-700',
    sent: 'bg-green-100 text-green-700',
  };
  
  return (
    <div className="bg-white rounded-xl border border-stone-200 hover:border-[#7C3AED]/30 hover:shadow-md transition-all overflow-hidden">
      {/* 헤더 */}
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-stone-800">{report.student?.name}</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              {report.report_year}년 {report.report_month}월
            </p>
          </div>
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[report.status]}`}>
            {statusInfo.label}
          </span>
        </div>
      </div>
      
      {/* 바디 */}
      <div className="p-4 space-y-3">
        {/* 템플릿 */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-stone-400">템플릿:</span>
          <span className="text-stone-700">{templateInfo?.name || `타입 ${report.template_type}`}</span>
        </div>
        
        {/* 출석률 & 평균 점수 */}
        <div className="flex gap-4">
          <div className="flex-1 p-3 bg-stone-50 rounded-lg">
            <p className="text-xs text-stone-500">출석률</p>
            <p className="text-lg font-bold text-stone-800">{attendanceRate}%</p>
          </div>
          <div className="flex-1 p-3 bg-stone-50 rounded-lg">
            <p className="text-xs text-stone-500">평균 점수</p>
            <p className="text-lg font-bold text-stone-800">
              {avgScore !== null ? `${avgScore}점` : '-'}
            </p>
          </div>
        </div>
        
        {/* AI 코멘트 여부 */}
        <div className="flex items-center gap-2 text-sm">
          {report.ai_study_comment ? (
            <span className="flex items-center gap-1 text-[#7C3AED]">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              AI 코멘트 생성됨
            </span>
          ) : (
            <span className="flex items-center gap-1 text-stone-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              AI 코멘트 미생성
            </span>
          )}
        </div>
        
        {/* 발송 정보 */}
        {report.sent_at && (
          <p className="text-xs text-stone-400">
            {new Date(report.sent_at).toLocaleDateString('ko-KR')} 발송 ({report.sent_method})
          </p>
        )}
      </div>
      
      {/* 푸터 */}
      <div className="px-4 py-3 border-t border-stone-100 flex justify-end gap-2">
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-sm text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          삭제
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm text-[#7C3AED] hover:bg-[#7C3AED]/5 rounded-lg font-medium transition-colors"
        >
          편집
        </button>
      </div>
    </div>
  );
}
