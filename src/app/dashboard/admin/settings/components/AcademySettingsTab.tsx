// ============================================================================
// 학원 설정 탭 컴포넌트
// ============================================================================
'use client';

import { useState } from 'react';
import { updateAcademyInfo, updateReportSettings } from '../actions/settings.actions';
import type {
  SettingsData,
  MessageTone,
  WeeklyTemplateType,
  MonthlyTemplateType,
} from '@/types/settings.types';
import {
  MESSAGE_TONE_OPTIONS,
  WEEKLY_TEMPLATE_OPTIONS,
  MONTHLY_TEMPLATE_OPTIONS,
} from '@/types/settings.types';
import { toast } from 'sonner';

interface Props {
  settings: SettingsData;
  onUpdate: () => void;
}

export default function AcademySettingsTab({ settings, onUpdate }: Props) {
  const { academy, report } = settings;
  
  // 학원 정보 상태
  const [displayName, setDisplayName] = useState(academy.display_name);
  const [phone, setPhone] = useState(academy.phone || '');
  const [curriculum, setCurriculum] = useState(academy.curriculum || '');
  const [messageTone, setMessageTone] = useState<MessageTone>(academy.message_tone);
  
  // 리포트 설정 상태
  const [strengthThreshold, setStrengthThreshold] = useState(report.strength_threshold);
  const [weaknessThreshold, setWeaknessThreshold] = useState(report.weakness_threshold);
  const [weeklyTemplate, setWeeklyTemplate] = useState<WeeklyTemplateType>(report.weekly_template_type);
  const [monthlyTemplate, setMonthlyTemplate] = useState<MonthlyTemplateType>(report.monthly_template_type);
  
  // 저장 상태
  const [savingAcademy, setSavingAcademy] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  
  // 학원 정보 저장
  async function handleSaveAcademy() {
    setSavingAcademy(true);
    const result = await updateAcademyInfo({
      display_name: displayName,
      phone: phone || null,
      curriculum: curriculum || null,
      message_tone: messageTone,
    });
    
    if (result.ok) {
      toast.success('학원 정보가 저장되었습니다');
      onUpdate();
    } else {
      toast.error(result.message);
    }
    setSavingAcademy(false);
  }
  
  // 리포트 설정 저장
  async function handleSaveReport() {
    setSavingReport(true);
    const result = await updateReportSettings({
      strength_threshold: strengthThreshold,
      weakness_threshold: weaknessThreshold,
      weekly_template_type: weeklyTemplate,
      monthly_template_type: monthlyTemplate,
    });
    
    if (result.ok) {
      toast.success('리포트 설정이 저장되었습니다');
      onUpdate();
    } else {
      toast.error(result.message);
    }
    setSavingReport(false);
  }
  
  return (
    <div className="space-y-6">
      {/* 기본 정보 섹션 */}
      <section className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">🏫 기본 정보</h2>
        
        <div className="space-y-4">
          {/* 학원명 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              학원명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
              placeholder="학원명을 입력하세요"
            />
          </div>
          
          {/* 연락처 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">연락처</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
              placeholder="053-123-4567"
            />
            <p className="text-xs text-stone-400 mt-1">리포트에 표시됩니다</p>
          </div>
          
          {/* 저장 버튼 */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveAcademy}
              disabled={savingAcademy || !displayName}
              className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-stone-300 text-white rounded-lg font-medium transition-colors"
            >
              {savingAcademy ? '저장 중...' : '기본 정보 저장'}
            </button>
          </div>
        </div>
      </section>
      
      {/* AI 설정 섹션 */}
      <section className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">🤖 AI 설정</h2>
        
        <div className="space-y-4">
          {/* 말투 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">말투</label>
            <div className="grid grid-cols-3 gap-3">
              {MESSAGE_TONE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMessageTone(option.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    messageTone === option.value
                      ? 'border-[#6366F1] bg-[#6366F1]/5'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <p className={`font-medium ${messageTone === option.value ? 'text-[#6366F1]' : 'text-stone-700'}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">{option.description}</p>
                </button>
              ))}
            </div>
          </div>
          
          {/* 커리큘럼 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              학원 커리큘럼 / 교육 철학
            </label>
            <textarea
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] resize-none"
              rows={4}
              placeholder="예: 저희 학원은 읽기 독립을 중시합니다. 파닉스부터 시작해 ORT 레벨을 거쳐 자기주도 읽기까지..."
            />
            <p className="text-xs text-stone-400 mt-1">
              AI가 리포트 작성 시 학원 특성을 반영합니다
            </p>
          </div>
          
          {/* 저장 버튼 */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveAcademy}
              disabled={savingAcademy}
              className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-stone-300 text-white rounded-lg font-medium transition-colors"
            >
              {savingAcademy ? '저장 중...' : 'AI 설정 저장'}
            </button>
          </div>
        </div>
      </section>
      
      {/* 리포트 설정 섹션 */}
      <section className="bg-white rounded-xl border border-stone-200 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">📊 리포트 설정</h2>
        
        <div className="space-y-6">
          {/* 주간 리포트 템플릿 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">주간 리포트 템플릿</label>
            <div className="grid grid-cols-3 gap-4">
              {WEEKLY_TEMPLATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setWeeklyTemplate(option.value)}
                  className={`group relative p-4 rounded-xl border-2 text-left transition-all ${
                    weeklyTemplate === option.value
                      ? 'border-[#6366F1] bg-[#6366F1]/5'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <p className={`text-base font-semibold ${weeklyTemplate === option.value ? 'text-[#6366F1]' : 'text-stone-700'}`}>
                    {option.label}
                  </p>
                  <p className="text-sm text-stone-500 mt-1">{option.description}</p>
                  
                  {/* 호버 시 미리보기 툴팁 */}
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-3 bg-stone-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-lg">
                    <p className="font-medium mb-1">📋 미리보기</p>
                    {option.value === 1 && <p>✅ 출석률 95%<br/>📚 숙제: 85점<br/>💬 이번 주 잘했어요!</p>}
                    {option.value === 2 && <p>📊 영역별 분석<br/>📈 숙제 85점 (▲5)<br/>📉 태도 78점 (▼2)<br/>💡 개선점: 집중력</p>}
                    {option.value === 3 && <p>🌟 이번 주 최고!<br/>💖 선생님이 응원해요<br/>🎯 다음 목표: 90점!</p>}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-stone-800" />
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* 월간 리포트 템플릿 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-3">월간 리포트 템플릿</label>
            <div className="space-y-3">
              {MONTHLY_TEMPLATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMonthlyTemplate(option.value)}
                  className={`group relative w-full p-4 rounded-xl border-2 text-left transition-all ${
                    monthlyTemplate === option.value
                      ? 'border-[#6366F1] bg-[#6366F1]/5'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className={`text-base font-semibold ${monthlyTemplate === option.value ? 'text-[#6366F1]' : 'text-stone-700'}`}>
                      {option.value}. {option.label}
                    </p>
                    <span className="text-sm text-stone-400">{option.target}</span>
                  </div>
                  <p className="text-sm text-stone-500 mt-1">{option.description}</p>
                  
                  {/* 호버 시 미리보기 툴팁 */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+8px)] w-56 p-4 bg-stone-800 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 shadow-lg">
                    <p className="font-medium mb-2">📋 포함 항목</p>
                    {option.value === 1 && <p>• 월간 학습 목표<br/>• 영역별 상세 코멘트<br/>• 선생님 총평<br/>• 다음 달 계획</p>}
                    {option.value === 2 && <p>• 출석률/숙제완수율 지표<br/>• 영역별 점수 차트<br/>• 월간 추이 그래프<br/>• 약점 분석 & 솔루션</p>}
                    {option.value === 3 && <p>• 이달의 키워드 #해시태그<br/>• Best Day 하이라이트<br/>• 성장 스토리<br/>• 선생님 칭찬 편지</p>}
                    {option.value === 4 && <p>• 출석 캘린더<br/>• 주간 진도 요약<br/>• 습관 지수<br/>• 학습 시간 통계</p>}
                    {option.value === 5 && <p>• 3줄 요약<br/>• 핵심 성과<br/>• Next Step<br/>• 행정 안내</p>}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-stone-800" />
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          {/* 강점/약점 기준점 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                강점 기준 (점)
              </label>
              <input
                type="number"
                value={strengthThreshold}
                onChange={(e) => setStrengthThreshold(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
              />
              <p className="text-xs text-stone-400 mt-1">이 점수 이상이면 강점으로 표시</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                약점 기준 (점)
              </label>
              <input
                type="number"
                value={weaknessThreshold}
                onChange={(e) => setWeaknessThreshold(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
              />
              <p className="text-xs text-stone-400 mt-1">이 점수 미만이면 약점으로 표시</p>
            </div>
          </div>
          
          {/* 저장 버튼 */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveReport}
              disabled={savingReport}
              className="px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-stone-300 text-white rounded-lg font-medium transition-colors"
            >
              {savingReport ? '저장 중...' : '리포트 설정 저장'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
