'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Crown } from 'lucide-react';
import type { ReportStyleTemplate } from '@/types/report';
import { STYLE_TEMPLATE_INFO } from '@/types/report';
import { useReportGeneration } from './hooks/useReportGeneration';
import { ReportCard, PeriodSelector, StudentSelector } from './components';
import { getTenantPlan } from './actions/report.actions';

type ReportTab = 'weekly' | 'monthly';

export function WeeklyReportClient() {
  const router = useRouter();
  
  // 탭 상태
  const [activeTab, setActiveTab] = useState<ReportTab>('weekly');
  
  // 플랜 상태
  const [plan, setPlan] = useState<'basic' | 'premium'>('basic');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // 공통 훅 사용
  const {
    settings,
    styleTemplate,
    setStyleTemplate,
    classes,
    students,
    selectedClassId,
    setSelectedClassId,
    selectedStudentIds,
    setSelectedStudentIds,
    startDate,
    endDate,
    handleDateChange,
    reports,
    setReports,
    isLoading,
    isLoadingStudents,
    isGenerating,
    handleGenerateReports,
    handleCloseReport,
  } = useReportGeneration();
  
  // 플랜 정보 로드
  useEffect(() => {
    const loadPlan = async () => {
      const result = await getTenantPlan();
      if (result.ok) {
        setPlan(result.data.plan);
      }
    };
    loadPlan();
  }, []);
  
  // 월간 탭 클릭 핸들러
  const handleMonthlyTabClick = () => {
    if (plan === 'premium') {
      // 프리미엄이면 월간 리포트 페이지로 이동
      router.push('/dashboard/admin/reports/monthly');
    } else {
      // 베이직이면 업그레이드 모달 표시
      setShowUpgradeModal(true);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#6366F1]" />
          <p className="mt-3 text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">리포트</h1>
        <p className="text-gray-600 mt-1">담당 반 학생들의 학습 성과를 확인하세요</p>
      </div>
      
      {/* 탭 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'weekly'
                ? 'border-[#6366F1] text-[#6366F1]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            주간 리포트
          </button>
          <button
            onClick={handleMonthlyTabClick}
            className="pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 border-transparent text-gray-500 hover:text-gray-700"
          >
            월간 AI 리포트
            {plan === 'premium' ? (
              <Crown className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
          </button>
        </nav>
      </div>
      
      {/* 주간 리포트 내용 */}
      <div className="space-y-6">
        {/* 설정 패널 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          {/* 기간 선택 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">📅 리포트 기간</h3>
            <PeriodSelector
              startDate={startDate}
              endDate={endDate}
              onDateChange={handleDateChange}
            />
          </div>
          
          <hr className="border-gray-100" />
          
          {/* 학생 선택 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">👨‍🎓 학생 선택</h3>
            <StudentSelector
              classes={classes}
              students={students}
              selectedClassId={selectedClassId}
              selectedStudentIds={selectedStudentIds}
              onClassChange={setSelectedClassId}
              onStudentChange={setSelectedStudentIds}
              isLoading={isLoadingStudents}
            />
          </div>
          
          <hr className="border-gray-100" />
          
          {/* 스타일 선택 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">🎨 리포트 스타일</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['simple', 'block', 'slider', 'heart'] as ReportStyleTemplate[]).map((tmpl) => (
                <button
                  key={tmpl}
                  onClick={() => setStyleTemplate(tmpl)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    styleTemplate === tmpl
                      ? 'border-[#6366F1] bg-[#EEF2FF]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {STYLE_TEMPLATE_INFO[tmpl].name}
                    </div>
                    <div className="text-xs text-gray-500 font-mono whitespace-nowrap overflow-hidden">
                      {tmpl === 'simple' && '🟢 태도  93'}
                      {tmpl === 'block' && '🟢 ▰▰▰▰▰▰▰▰▰▱'}
                      {tmpl === 'slider' && '🟢 ━━━━━━━━◉─'}
                      {tmpl === 'heart' && '💗 ❤️❤️❤️❤️❤️'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* 생성 버튼 */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleGenerateReports}
              disabled={isGenerating || selectedStudentIds.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-[#6366F1] text-white font-medium rounded-lg hover:bg-[#4F46E5] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  생성 중...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  리포트 생성 ({selectedStudentIds.length}명)
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* 리포트 결과 */}
        {reports.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                생성된 리포트 ({reports.length}명)
              </h2>
              <button
                onClick={() => setReports([])}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                전체 닫기
              </button>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {reports.map((report) => (
                <ReportCard
                  key={report.student.id}
                  report={report}
                  tone={settings.messageTone}
                  styleTemplate={styleTemplate}
                  onClose={() => handleCloseReport(report.student.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* 빈 상태 */}
        {reports.length === 0 && !isGenerating && selectedStudentIds.length > 0 && (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-600">
              위에서 기간과 학생을 선택한 후<br />
              <strong>리포트 생성</strong> 버튼을 눌러주세요
            </p>
          </div>
        )}
      </div>
      
      {/* 업그레이드 모달 */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowUpgradeModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              프리미엄 기능입니다
            </h3>
            <p className="text-gray-600 mb-6">
              월간 AI 리포트는 프리미엄 플랜에서<br />
              사용할 수 있습니다.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  router.push('/dashboard/admin/settings?tab=academy');
                }}
                className="w-full py-3 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                플랜 업그레이드
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
