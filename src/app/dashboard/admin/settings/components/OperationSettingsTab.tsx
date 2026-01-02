// ============================================================================
// 운영 설정 탭 컴포넌트
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { SettingsData } from '@/types/settings.types';
import {
  getOperationSettings,
  updateBasicSettings,
  updateMakeupDefaults,
  updateOperationMode,  // 🆕 추가
  type BasicSettings,
  type MakeupDefaults,
  type OperationMode,   // 🆕 추가
} from '../actions/settings.actions';
import BasicSettingsSection from './BasicSettingsSection';
import MakeupSettingsSection from './MakeupSettingsSection';
import MaterialsAddonSection from './MaterialsAddonSection';

interface Props {
  settings: SettingsData;
  onUpdate: () => void;
}

export default function OperationSettingsTab({ settings, onUpdate }: Props) {
  const { stats } = settings;
  
  // 운영 설정 상태
  const [basicSettings, setBasicSettings] = useState<BasicSettings>({
    progress_enabled: false,
    exam_score_enabled: false,
  });
  const [operationMode, setOperationMode] = useState<OperationMode>('solo');  // 🆕 추가
  const [makeupDefaults, setMakeupDefaults] = useState<MakeupDefaults>({
    '병결': true,
    '학교행사': true,
    '가사': false,
    '무단': false,
    '기타': true,
  });
  const [hasMakeupSystem, setHasMakeupSystem] = useState(false);
  const [hasMaterialsAddon, setHasMaterialsAddon] = useState(false);
  
  // 로딩/저장 상태
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [isSavingMode, setIsSavingMode] = useState(false);  // 🆕 추가
  const [isSavingMakeup, setIsSavingMakeup] = useState(false);
  
  // 초기 데이터 로드
  useEffect(() => {
    loadOperationSettings();
  }, []);
  
  async function loadOperationSettings() {
    setIsLoading(true);
    const result = await getOperationSettings();
    
    if (result.ok) {
      setBasicSettings(result.data.basic);
      setOperationMode(result.data.operationMode);  // 🆕 추가
      setMakeupDefaults(result.data.makeupDefaults);
      setHasMakeupSystem(result.data.hasMakeupSystem);
      setHasMaterialsAddon(result.data.hasMaterialsAddon);
    } else {
      toast.error(result.message);
    }
    
    setIsLoading(false);
  }
  
  // 기본 설정 업데이트
  async function handleUpdateBasicSetting(key: keyof BasicSettings, value: boolean) {
    const newSettings = { ...basicSettings, [key]: value };
    setBasicSettings(newSettings);
    setIsSavingBasic(true);
    
    const result = await updateBasicSettings(newSettings);
    
    if (result.ok) {
      toast.success('설정이 저장되었습니다');
    } else {
      // 실패 시 롤백
      setBasicSettings(basicSettings);
      toast.error(result.message);
    }
    
    setIsSavingBasic(false);
  }
  
  // 🆕 운영 모드 업데이트
  async function handleUpdateOperationMode(mode: OperationMode) {
    const previousMode = operationMode;
    setOperationMode(mode);
    setIsSavingMode(true);
    
    const result = await updateOperationMode(mode);
    
    if (result.ok) {
      toast.success(
        mode === 'solo' 
          ? '담임형 모드로 변경되었습니다' 
          : '담임+보조 모드로 변경되었습니다'
      );
    } else {
      // 실패 시 롤백
      setOperationMode(previousMode);
      toast.error(result.message);
    }
    
    setIsSavingMode(false);
  }
  
  // 보강 설정 업데이트
  async function handleUpdateMakeupDefault(reasonKey: string, checked: boolean) {
    const newDefaults = { ...makeupDefaults, [reasonKey]: checked };
    setMakeupDefaults(newDefaults);
    setIsSavingMakeup(true);
    
    const result = await updateMakeupDefaults(newDefaults);
    
    if (result.ok) {
      toast.success('보강 설정이 저장되었습니다');
    } else {
      // 실패 시 롤백
      setMakeupDefaults(makeupDefaults);
      toast.error(result.message);
    }
    
    setIsSavingMakeup(false);
  }
  
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="text-stone-500">설정을 불러오는 중...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 상단: 기본 항목 + 결석/보강 (2열 그리드) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 기본 항목 설정 */}
        <BasicSettingsSection
          settings={basicSettings}
          operationMode={operationMode}           // 🆕 추가
          isSaving={isSavingBasic}
          isSavingMode={isSavingMode}             // 🆕 추가
          onUpdateSetting={handleUpdateBasicSetting}
          onUpdateOperationMode={handleUpdateOperationMode}  // 🆕 추가
        />
        
        {/* 결석/보강 설정 */}
        <MakeupSettingsSection
          makeupDefaults={makeupDefaults}
          isSaving={isSavingMakeup}
          hasMakeupSystem={hasMakeupSystem}
          onToggle={handleUpdateMakeupDefault}
          onUpgradeClick={() => {
            toast.info('프리미엄 요금제로 업그레이드하시면 결석/보강 관리 기능을 사용하실 수 있습니다.');
          }}
        />
      </div>
      
      {/* 교재 재고 관리 (유료 옵션) */}
      <MaterialsAddonSection
        hasAddon={hasMaterialsAddon}
        onUpgradeClick={() => {
          toast.info('교재 재고 관리 기능은 별도 구매 시 사용할 수 있습니다.');
        }}
      />
      
      {/* 바로가기 링크들 (3열 그리드) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 피드 항목 관리 */}
        <Link
          href="/dashboard/admin/feed-settings"
          className="bg-white rounded-xl border border-stone-200 p-5 hover:border-[#6366F1]/30 hover:bg-[#6366F1]/5 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-stone-800 group-hover:text-[#6366F1]">📋 피드 항목</h3>
            <span className="text-lg font-bold text-stone-700">{stats.feedSetCount}</span>
          </div>
          <p className="text-sm text-stone-500">평가 항목 설정</p>
          {stats.unmappedCategoryCount > 0 && (
            <p className="text-xs text-amber-600 mt-2">⚠️ {stats.unmappedCategoryCount}개 미지정</p>
          )}
        </Link>
        
        {/* 선생님 관리 */}
        <Link
          href="/dashboard/admin/teachers"
          className="bg-white rounded-xl border border-stone-200 p-5 hover:border-[#6366F1]/30 hover:bg-[#6366F1]/5 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-stone-800 group-hover:text-[#6366F1]">👩‍🏫 선생님 관리</h3>
            <span className="text-lg font-bold text-stone-700">{stats.teacherCount}</span>
          </div>
          <p className="text-sm text-stone-500">선생님 정보 및 권한</p>
        </Link>
        
        {/* 담당반 배정 */}
        <Link
          href="/dashboard/admin/classes"
          className="bg-white rounded-xl border border-stone-200 p-5 hover:border-[#6366F1]/30 hover:bg-[#6366F1]/5 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-stone-800 group-hover:text-[#6366F1]">🏠 담당반 배정</h3>
          </div>
          <p className="text-sm text-stone-500">선생님별 담당 반 설정</p>
        </Link>
      </div>
    </div>
  );
}
