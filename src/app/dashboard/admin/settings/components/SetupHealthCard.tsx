// ============================================================================
// Setup Health 카드 컴포넌트
// ============================================================================
'use client';

import type { SetupHealth, SetupHealthItem } from '@/types/settings.types';

interface Props {
  health: SetupHealth;
  onRefresh: () => void;
}

export default function SetupHealthCard({ health, onRefresh }: Props) {
  const { items, overallStatus } = health;
  
  // 상태별 아이콘
  function getStatusIcon(status: SetupHealthItem['status']) {
    switch (status) {
      case 'complete':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  }
  
  // 완료율 계산
  const completeCount = items.filter(item => item.status === 'complete').length;
  const percentage = Math.round((completeCount / items.length) * 100);
  
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            overallStatus === 'complete' ? 'bg-[#6366F1]/10' : 'bg-amber-100'
          }`}>
            {overallStatus === 'complete' ? (
              <svg className="w-5 h-5 text-[#6366F1]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-stone-800">Setup Health</h3>
            <p className="text-sm text-stone-500">
              {overallStatus === 'complete' 
                ? '모든 설정이 완료되었습니다!' 
                : '몇 가지 설정이 필요합니다'}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className={`text-2xl font-bold ${
            overallStatus === 'complete' ? 'text-[#6366F1]' : 'text-amber-600'
          }`}>
            {percentage}%
          </p>
          <p className="text-xs text-stone-500">{completeCount}/{items.length} 완료</p>
        </div>
      </div>
      
      {/* 체크 항목 */}
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-sm"
            title={item.message}
          >
            {getStatusIcon(item.status)}
            <span className={item.status === 'complete' ? 'text-stone-600' : 'text-stone-800'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      
      {/* 경고 메시지 (있으면) */}
      {items.some(item => item.status !== 'complete' && item.message) && (
        <div className="mt-4 pt-4 border-t border-amber-200 space-y-1">
          {items
            .filter(item => item.status !== 'complete' && item.message)
            .map((item) => (
              <p key={item.key} className="text-sm text-stone-600">
                • {item.message}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
