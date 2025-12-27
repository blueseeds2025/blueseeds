'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Package, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface TenantSettings {
  progress_enabled: boolean;
  materials_enabled: boolean;
  exam_score_enabled: boolean;
}

interface BasicSettingsSectionProps {
  supabase: any;
  getTenantId: () => Promise<string | null>;
}

export default function BasicSettingsSection({ 
  supabase, 
  getTenantId 
}: BasicSettingsSectionProps) {
  const [settings, setSettings] = useState<TenantSettings>({
    progress_enabled: false,
    materials_enabled: false,
    exam_score_enabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 설정 로드
  useEffect(() => {
    async function loadSettings() {
      try {
        const tenantId = await getTenantId();
        if (!tenantId) return;

        const { data: tenant } = await supabase
          .from('tenants')
          .select('settings')
          .eq('id', tenantId)
          .single();

        if (tenant?.settings) {
          setSettings({
            progress_enabled: tenant.settings.progress_enabled ?? false,
            materials_enabled: tenant.settings.materials_enabled ?? false,
            exam_score_enabled: tenant.settings.exam_score_enabled ?? false,
          });
        }
      } catch (error) {
        console.error('설정 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [supabase, getTenantId]);

  // 설정 저장
  const updateSetting = async (key: keyof TenantSettings, value: boolean) => {
    setIsSaving(true);
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      const tenantId = await getTenantId();
      if (!tenantId) throw new Error('Tenant ID not found');

      const { error } = await supabase
        .from('tenants')
        .update({ settings: newSettings })
        .eq('id', tenantId);

      if (error) throw error;

      toast.success('설정이 저장되었습니다', { duration: 2000 });
    } catch (error) {
      console.error('설정 저장 실패:', error);
      toast.error('설정 저장에 실패했습니다');
      // 롤백
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6 border-[#E8E5E0]">
        <CardContent className="py-4">
          <div className="text-gray-500 text-sm">설정 불러오는 중...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-[#E8E5E0]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-[#37352F]">
          기본 항목 설정
        </CardTitle>
        <p className="text-sm text-[#9B9A97]">
          피드 입력 시 표시할 기본 항목을 선택하세요
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 진도 입력 */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#6366F1]" />
            <div>
              <div className="font-medium text-[#37352F]">진도 입력</div>
              <div className="text-xs text-[#9B9A97]">학생별 학습 진도 기록</div>
            </div>
          </div>
          <Switch
            checked={settings.progress_enabled}
            onCheckedChange={(v) => updateSetting('progress_enabled', v)}
            disabled={isSaving}
            className="data-[state=checked]:bg-[#6366F1]"
          />
        </div>

        {/* 교재 사용 */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-[#059669]" />
            <div>
              <div className="font-medium text-[#37352F]">교재 사용</div>
              <div className="text-xs text-[#9B9A97]">수업 중 사용한 교재 기록 (재고 연동 예정)</div>
            </div>
          </div>
          <Switch
            checked={settings.materials_enabled}
            onCheckedChange={(v) => updateSetting('materials_enabled', v)}
            disabled={isSaving}
            className="data-[state=checked]:bg-[#059669]"
          />
        </div>

        {/* 시험 점수 */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#EA580C]" />
            <div>
              <div className="font-medium text-[#37352F]">시험 점수</div>
              <div className="text-xs text-[#9B9A97]">시험/퀴즈 점수 입력 (v1.1 예정)</div>
            </div>
          </div>
          <Switch
            checked={settings.exam_score_enabled}
            onCheckedChange={(v) => updateSetting('exam_score_enabled', v)}
            disabled={isSaving}
            className="data-[state=checked]:bg-[#EA580C]"
          />
        </div>
      </CardContent>
    </Card>
  );
}
