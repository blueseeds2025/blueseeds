// ============================================================================
// 통합 설정 클라이언트 컴포넌트
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSettingsData, getSetupHealth } from './actions/settings.actions';
import type { SettingsData, SetupHealth } from '@/types/settings.types';
import SetupHealthCard from './components/SetupHealthCard';
import AcademySettingsTab from './components/AcademySettingsTab';
import OperationSettingsTab from './components/OperationSettingsTab';
import QuickActions from './components/QuickActions';
import { toast } from 'sonner';

type TabType = 'academy' | 'operation';

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL에서 탭 파라미터 읽기
  const tabParam = searchParams.get('tab');
  const initialTab: TabType = tabParam === 'operation' ? 'operation' : 'academy';
  
  // 상태
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [setupHealth, setSetupHealth] = useState<SetupHealth | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 초기 데이터 로드
  useEffect(() => {
    loadData();
  }, []);
  
  // 탭 변경 시 URL 업데이트
  function handleTabChange(tab: TabType) {
    setActiveTab(tab);
    router.push(`/dashboard/admin/settings?tab=${tab}`, { scroll: false });
  }
  
  async function loadData() {
    setLoading(true);
    
    const [settingsResult, healthResult] = await Promise.all([
      getSettingsData(),
      getSetupHealth(),
    ]);
    
    if (settingsResult.ok) {
      setSettings(settingsResult.data);
    } else {
      toast.error(settingsResult.message);
    }
    
    if (healthResult.ok) {
      setSetupHealth(healthResult.data);
    }
    
    setLoading(false);
  }
  
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-stone-500">설정을 불러오는 중...</div>
      </div>
    );
  }
  
  if (!settings) {
    return (
      <div className="p-6 text-center">
        <p className="text-stone-500">설정을 불러올 수 없습니다.</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 text-[#7C3AED] hover:bg-[#7C3AED]/5 rounded-lg"
        >
          다시 시도
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-800">학원 설정</h1>
          {settings && (
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              settings.academy.plan === 'premium' 
                ? 'bg-[#6366F1]/10 text-[#6366F1]' 
                : 'bg-stone-100 text-stone-600'
            }`}>
              {settings.academy.plan === 'premium' ? 'Premium' : 'Basic'}
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500">
          학원 정보와 운영 설정을 한 곳에서 관리합니다
        </p>
      </div>
      
      {/* Setup Health */}
      {setupHealth && (
        <SetupHealthCard health={setupHealth} onRefresh={loadData} />
      )}
      
      {/* 탭 */}
      <div className="flex gap-1 p-1.5 bg-stone-100 rounded-xl w-fit">
        <button
          onClick={() => handleTabChange('academy')}
          className={`px-6 py-3 rounded-lg text-base font-medium transition-colors ${
            activeTab === 'academy'
              ? 'bg-white text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          🏫 학원 설정
        </button>
        <button
          onClick={() => handleTabChange('operation')}
          className={`px-6 py-3 rounded-lg text-base font-medium transition-colors ${
            activeTab === 'operation'
              ? 'bg-white text-stone-800 shadow-sm'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          ⚙️ 운영 설정
        </button>
      </div>
      
      {/* 탭 컨텐츠 */}
      <div className="min-h-[400px]">
        {activeTab === 'academy' && (
          <AcademySettingsTab settings={settings} onUpdate={loadData} />
        )}
        {activeTab === 'operation' && (
          <OperationSettingsTab settings={settings} onUpdate={loadData} />
        )}
      </div>
      
      {/* Quick Actions */}
      <QuickActions stats={settings.stats} />
    </div>
  );
}
