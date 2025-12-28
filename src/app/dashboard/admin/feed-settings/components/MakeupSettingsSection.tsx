'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { PREMIUM_COLORS } from '@/lib/premium.styles';

// 결석 사유 목록
const ABSENCE_REASONS = [
  { key: '병결', label: '병결', description: '질병으로 인한 결석' },
  { key: '학교행사', label: '학교행사', description: '학교 일정으로 인한 결석' },
  { key: '가사', label: '가사', description: '가정 사정으로 인한 결석' },
  { key: '무단', label: '무단', description: '사전 연락 없는 결석' },
  { key: '기타', label: '기타', description: '기타 사유' },
];

interface MakeupSettingsSectionProps {
  supabase: SupabaseClient<Database>;
  getTenantId: () => Promise<string | null>;
  /** 기능 활성화 여부 (tenant_features에서) */
  hasMakeupSystem?: boolean;
  /** 업그레이드 안내 콜백 */
  onUpgradeClick?: () => void;
}

export default function MakeupSettingsSection({
  supabase,
  getTenantId,
  hasMakeupSystem = false,
  onUpgradeClick,
}: MakeupSettingsSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // 보강 기본 설정 (사유별 보강 필요 여부)
  const [makeupDefaults, setMakeupDefaults] = useState<Record<string, boolean>>({
    '병결': true,
    '학교행사': true,
    '가사': false,
    '무단': false,
    '기타': true,
  });

  // 설정 불러오기
  const loadSettings = useCallback(async () => {
    try {
      const tenantId = await getTenantId();
      if (!tenantId) return;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();

      if (tenant?.settings) {
        const settings = tenant.settings as Record<string, any>;
        if (settings.makeup_defaults) {
          setMakeupDefaults(settings.makeup_defaults);
        }
      }
    } catch (error) {
      console.error('Failed to load makeup settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, getTenantId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 설정 저장
  const saveSettings = async (newDefaults: Record<string, boolean>) => {
    if (!hasMakeupSystem) return;
    
    setIsSaving(true);
    try {
      const tenantId = await getTenantId();
      if (!tenantId) return;

      // 기존 settings 가져오기
      const { data: tenant } = await supabase
        .from('tenants')
        .select('settings')
        .eq('id', tenantId)
        .single();

      const currentSettings = (tenant?.settings as Record<string, any>) || {};

      // makeup_defaults 업데이트
      const { error } = await supabase
        .from('tenants')
        .update({
          settings: {
            ...currentSettings,
            makeup_defaults: newDefaults,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;
      
      toast.success('보강 설정이 저장되었습니다');
    } catch (error) {
      console.error('Failed to save makeup settings:', error);
      toast.error('설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  // 체크박스 변경 핸들러
  const handleToggle = (reasonKey: string, checked: boolean) => {
    const newDefaults = {
      ...makeupDefaults,
      [reasonKey]: checked,
    };
    setMakeupDefaults(newDefaults);
    saveSettings(newDefaults);
  };

  // 기능 잠금 상태
  const isLocked = !hasMakeupSystem;

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
  onCheckedChange={(checked) => handleToggle(reason.key, checked as boolean)}
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
