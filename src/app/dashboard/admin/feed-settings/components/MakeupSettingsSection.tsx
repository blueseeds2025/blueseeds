'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, AlertCircle, Lock } from 'lucide-react';
import { PREMIUM_COLORS } from '@/lib/premium.styles';

// ============================================================================
// Constants
// ============================================================================

const ABSENCE_REASONS = [
  { key: '병결', label: '병결', description: '질병으로 인한 결석' },
  { key: '학교행사', label: '학교행사', description: '학교 일정으로 인한 결석' },
  { key: '가사', label: '가사', description: '가정 사정으로 인한 결석' },
  { key: '무단', label: '무단', description: '사전 연락 없는 결석' },
  { key: '기타', label: '기타', description: '기타 사유' },
];

// ============================================================================
// Types
// ============================================================================

interface MakeupSettingsSectionProps {
  makeupDefaults: Record<string, boolean>;
  isLoading: boolean;
  isSaving: boolean;
  hasMakeupSystem: boolean;
  onToggle: (reasonKey: string, checked: boolean) => void;
  onUpgradeClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export default function MakeupSettingsSection({
  makeupDefaults,
  isLoading,
  isSaving,
  hasMakeupSystem,
  onToggle,
  onUpgradeClick,
}: MakeupSettingsSectionProps) {
  const isLocked = !hasMakeupSystem;

  if (isLoading) {
    return (
      <Card className="border border-[#E8E5E0] shadow-sm">
        <CardContent className="py-4">
          <div className="text-gray-500 text-sm">설정 불러오는 중...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-[#E8E5E0] shadow-sm relative overflow-hidden">
      {/* 잠금 오버레이 */}
      {isLocked && (
        <div 
          className="absolute inset-0 z-10 backdrop-blur-[1px] flex items-center justify-center"
          style={{ backgroundColor: PREMIUM_COLORS.backgroundOverlay }}
        >
          <div className="text-center px-6 py-4 bg-white rounded-xl shadow-lg max-w-sm">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: PREMIUM_COLORS.background }}
            >
              <Lock className="w-6 h-6" style={{ color: PREMIUM_COLORS.primary }} />
            </div>
            <h3 className="font-semibold text-[#1F2937] mb-1">프리미엄 기능</h3>
            <p className="text-sm mb-4" style={{ color: PREMIUM_COLORS.textMuted }}>
              결석/보강 관리 기능은 프리미엄 요금제에서 사용할 수 있습니다.
            </p>
            <button
              onClick={onUpgradeClick}
              className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
              style={{ backgroundColor: PREMIUM_COLORS.primary }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = PREMIUM_COLORS.primaryHover}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = PREMIUM_COLORS.primary}
            >
              업그레이드 안내
            </button>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#37352F]">
          <Calendar className="w-5 h-5 text-[#F59E0B]" />
          결석/보강 설정
          {isLocked && (
            <span 
              className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: PREMIUM_COLORS.background, color: PREMIUM_COLORS.text }}
            >
              <Lock className="w-3 h-3" />
              프리미엄
            </span>
          )}
        </CardTitle>
        <p className="text-sm text-[#9B9A97]">
          결석 사유별 보강 필요 여부를 설정합니다
        </p>
      </CardHeader>

      <CardContent className={`space-y-4 ${isLocked ? 'opacity-50' : ''}`}>
        {/* 안내 메시지 */}
        <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] rounded-lg">
          <AlertCircle className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
          <p className="text-sm text-[#92400E]">
            체크된 사유로 결석 시 자동으로 보강 필요로 체크됩니다.
            교사가 피드 입력 시 개별적으로 변경할 수 있습니다.
          </p>
        </div>

        {/* 사유별 설정 */}
        <div className="space-y-3">
          {ABSENCE_REASONS.map((reason) => (
            <div
              key={reason.key}
              className="flex items-center justify-between p-3 bg-[#F7F6F3] rounded-lg hover:bg-[#F3F2EF] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={`makeup-${reason.key}`}
                  checked={makeupDefaults[reason.key] ?? false}
                  onCheckedChange={(checked) => onToggle(reason.key, checked as boolean)}
                  disabled={isLocked || isSaving}
                  className="data-[state=checked]:bg-[#7C3AED] data-[state=checked]:border-[#7C3AED]"
                />
                <label
                  htmlFor={`makeup-${reason.key}`}
                  className="cursor-pointer"
                >
                  <span className="font-medium text-[#37352F]">{reason.label}</span>
                  <span className="text-sm text-[#9B9A97] ml-2">{reason.description}</span>
                </label>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                makeupDefaults[reason.key]
                  ? 'bg-[#DCFCE7] text-[#166534]'
                  : 'bg-[#F3F4F6] text-[#6B7280]'
              }`}>
                {makeupDefaults[reason.key] ? '보강 필요' : '보강 불필요'}
              </span>
            </div>
          ))}
        </div>

        {/* 저장 상태 표시 */}
        {isSaving && (
          <div className="text-center text-sm text-[#9B9A97]">
            저장 중...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
