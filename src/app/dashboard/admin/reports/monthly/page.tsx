// ============================================================================
// 월간 리포트 목록 페이지
// ============================================================================
import { Suspense } from 'react';
import MonthlyReportClient from './MonthlyReportClient';

export const metadata = {
  title: '월간 리포트 | 리드앤톡',
};

export default function MonthlyReportPage() {
  return (
    <Suspense fallback={<MonthlyReportSkeleton />}>
      <MonthlyReportClient />
    </Suspense>
  );
}

function MonthlyReportSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-stone-200 rounded" />
        <div className="h-10 w-32 bg-stone-200 rounded" />
      </div>
      
      {/* 필터 */}
      <div className="flex gap-4">
        <div className="h-10 w-32 bg-stone-200 rounded" />
        <div className="h-10 w-32 bg-stone-200 rounded" />
        <div className="h-10 w-32 bg-stone-200 rounded" />
      </div>
      
      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-stone-200 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
