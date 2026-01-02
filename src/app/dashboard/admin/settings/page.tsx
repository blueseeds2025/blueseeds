// ============================================================================
// 통합 설정 메인 페이지
// ============================================================================
import { Suspense } from 'react';
import SettingsClient from './SettingsClient';

export const metadata = {
  title: '학원 설정 | 리드앤톡',
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsClient />
    </Suspense>
  );
}

function SettingsSkeleton() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Setup Health */}
      <div className="h-24 bg-stone-200 rounded-xl" />
      
      {/* 탭 */}
      <div className="flex gap-2">
        <div className="h-10 w-28 bg-stone-200 rounded-lg" />
        <div className="h-10 w-28 bg-stone-200 rounded-lg" />
      </div>
      
      {/* 컨텐츠 */}
      <div className="space-y-4">
        <div className="h-48 bg-stone-200 rounded-xl" />
        <div className="h-48 bg-stone-200 rounded-xl" />
      </div>
    </div>
  );
}
