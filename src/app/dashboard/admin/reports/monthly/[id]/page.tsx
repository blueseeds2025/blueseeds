// ============================================================================
// 리포트 상세/편집 페이지
// ============================================================================
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import ReportDetailClient from './ReportDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: '리포트 편집 | 리드앤톡',
};

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  
  if (!id) {
    notFound();
  }
  
  return (
    <Suspense fallback={<ReportDetailSkeleton />}>
      <ReportDetailClient reportId={id} />
    </Suspense>
  );
}

function ReportDetailSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-stone-200 rounded-lg" />
        <div>
          <div className="h-6 w-48 bg-stone-200 rounded" />
          <div className="h-4 w-32 bg-stone-200 rounded mt-2" />
        </div>
      </div>
      
      {/* 탭 */}
      <div className="flex gap-2">
        <div className="h-10 w-24 bg-stone-200 rounded-lg" />
        <div className="h-10 w-24 bg-stone-200 rounded-lg" />
        <div className="h-10 w-24 bg-stone-200 rounded-lg" />
      </div>
      
      {/* 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96 bg-stone-200 rounded-xl" />
        <div className="h-96 bg-stone-200 rounded-xl" />
      </div>
    </div>
  );
}
