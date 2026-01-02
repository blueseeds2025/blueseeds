// ============================================================================
// 교재 재고 관리 유료 옵션 섹션 (운영 설정 탭용)
// ============================================================================
'use client';

import { Package, Lock, Sparkles } from 'lucide-react';

// 유료 옵션 색상
const PAID_OPTION_COLORS = {
  primary: '#059669',
  primaryHover: '#047857',
  background: '#ECFDF5',
  backgroundOverlay: 'rgba(5, 150, 105, 0.05)',
  text: '#059669',
  textMuted: '#6B7280',
};

interface MaterialsAddonSectionProps {
  hasAddon: boolean;
  onUpgradeClick?: () => void;
}

export default function MaterialsAddonSection({
  hasAddon,
  onUpgradeClick,
}: MaterialsAddonSectionProps) {
  const isLocked = !hasAddon;

  return (
    <section className="bg-white rounded-xl border border-stone-200 p-5 relative overflow-hidden">
      {/* 잠금 오버레이 */}
      {isLocked && (
        <div 
          className="absolute inset-0 z-10 backdrop-blur-[1px] flex items-center justify-center"
          style={{ backgroundColor: PAID_OPTION_COLORS.backgroundOverlay }}
        >
          <div className="text-center px-4 py-3 bg-white rounded-xl shadow-lg max-w-xs">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
              style={{ backgroundColor: PAID_OPTION_COLORS.background }}
            >
              <Sparkles className="w-5 h-5" style={{ color: PAID_OPTION_COLORS.primary }} />
            </div>
            <h3 className="font-semibold text-stone-800 text-sm mb-1">유료 옵션</h3>
            <p className="text-xs mb-3" style={{ color: PAID_OPTION_COLORS.textMuted }}>
              교재 재고 관리 기능은 별도 구매 시 사용할 수 있습니다.
            </p>
            <button
              onClick={onUpgradeClick}
              className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors"
              style={{ backgroundColor: PAID_OPTION_COLORS.primary }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = PAID_OPTION_COLORS.primaryHover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = PAID_OPTION_COLORS.primary}
            >
              자세히 보기
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#059669]/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-[#059669]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-stone-800">교재 재고 관리</h2>
              {isLocked && (
                <span 
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded"
                  style={{ backgroundColor: PAID_OPTION_COLORS.background, color: PAID_OPTION_COLORS.text }}
                >
                  <Lock className="w-3 h-3" />
                  유료
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500">교재 사용 기록 및 재고 자동 차감</p>
          </div>
        </div>
      </div>
    </section>
  );
}
