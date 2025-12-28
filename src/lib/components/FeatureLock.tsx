'use client';

import { ReactNode } from 'react';
import { FeatureKey, FEATURE_INFO, hasFeature } from '@/lib/features';
import { PREMIUM_COLORS } from '@/lib/premium.styles';

interface FeatureLockProps {
  /** 체크할 기능 키 */
  featureKey: FeatureKey;
  /** 활성화된 기능 목록 */
  enabledFeatures: string[];
  /** 기능이 있을 때 보여줄 컨텐츠 */
  children: ReactNode;
  /** 잠금 시 대체 UI (없으면 기본 잠금 UI) */
  fallback?: ReactNode;
  /** 잠금 시 완전히 숨길지 여부 */
  hideWhenLocked?: boolean;
  /** 클릭 시 업그레이드 안내 콜백 */
  onUpgradeClick?: () => void;
}

/**
 * 기능 잠금 래퍼 컴포넌트
 * 
 * 사용 예시:
 * <FeatureLock featureKey="makeup_system" enabledFeatures={features}>
 *   <button>보강</button>
 * </FeatureLock>
 */
export function FeatureLock({
  featureKey,
  enabledFeatures,
  children,
  fallback,
  hideWhenLocked = false,
  onUpgradeClick,
}: FeatureLockProps) {
  const isEnabled = hasFeature(enabledFeatures, featureKey);
  
  // 기능 활성화됨 → 그대로 렌더링
  if (isEnabled) {
    return <>{children}</>;
  }
  
  // 잠금 시 완전히 숨김
  if (hideWhenLocked) {
    return null;
  }
  
  // 커스텀 fallback 있으면 사용
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // 기본 잠금 UI
  const featureInfo = FEATURE_INFO[featureKey];
  
  return (
    <div className="relative">
      {/* 흐릿하게 보여주기 */}
      <div className="opacity-50 pointer-events-none select-none">
        {children}
      </div>
      
      {/* 잠금 오버레이 */}
      <div 
        className="absolute inset-0 flex items-center justify-center rounded-lg cursor-pointer"
        style={{ backgroundColor: PREMIUM_COLORS.backgroundOverlay }}
        onClick={onUpgradeClick}
      >
        <div className="text-center px-4">
          <div 
            className="flex items-center justify-center gap-1.5 font-medium text-sm"
            style={{ color: PREMIUM_COLORS.primary }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>프리미엄</span>
          </div>
          {featureInfo && (
            <p className="text-xs mt-1" style={{ color: PREMIUM_COLORS.textMuted }}>
              {featureInfo.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 기능 잠금 배지 (버튼 옆에 표시용)
 */
export function FeatureLockBadge({
  featureKey,
  enabledFeatures,
}: {
  featureKey: FeatureKey;
  enabledFeatures: string[];
}) {
  const isEnabled = hasFeature(enabledFeatures, featureKey);
  
  if (isEnabled) return null;
  
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
      style={{ 
        backgroundColor: PREMIUM_COLORS.background, 
        color: PREMIUM_COLORS.text 
      }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      프리미엄
    </span>
  );
}

/**
 * 기능 잠금 카드 (설정 페이지용)
 */
export function FeatureLockCard({
  featureKey,
  enabledFeatures,
  children,
  onUpgradeClick,
}: {
  featureKey: FeatureKey;
  enabledFeatures: string[];
  children: ReactNode;
  onUpgradeClick?: () => void;
}) {
  const isEnabled = hasFeature(enabledFeatures, featureKey);
  const featureInfo = FEATURE_INFO[featureKey];
  
  if (isEnabled) {
    return <>{children}</>;
  }
  
  return (
    <div 
      className="relative border-2 border-dashed rounded-xl p-6"
      style={{ 
        borderColor: PREMIUM_COLORS.locked.border,
        backgroundColor: '#F9FAFB'
      }}
    >
      <div className="opacity-40 pointer-events-none">
        {children}
      </div>
      
      {/* 잠금 안내 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg px-6 py-4 text-center max-w-xs">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: PREMIUM_COLORS.background }}
          >
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              style={{ color: PREMIUM_COLORS.primary }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-semibold text-[#1F2937] mb-1">
            {featureInfo?.name || '프리미엄 기능'}
          </h3>
          <p className="text-sm mb-4" style={{ color: PREMIUM_COLORS.textMuted }}>
            {featureInfo?.description || '이 기능은 프리미엄 요금제에서 사용할 수 있습니다.'}
          </p>
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
            style={{ 
              backgroundColor: PREMIUM_COLORS.primary,
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = PREMIUM_COLORS.primaryHover}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = PREMIUM_COLORS.primary}
          >
            업그레이드 안내
          </button>
        </div>
      </div>
    </div>
  );
}
