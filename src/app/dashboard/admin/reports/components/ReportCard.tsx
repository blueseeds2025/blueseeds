'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { WeeklyReportData, MessageTone, ReportStyleTemplate } from '@/types/report';
import { 
  scoreToBlockGauge, 
  scoreToSliderGauge, 
  scoreToHeartGauge,
  getScoreEmoji,
  getCategoryEmoji,
  countToDots
} from '@/types/report';
import { generateReportText, generateReportTextShort, copyToClipboard } from '../utils/reportText';
import { getScoreColor, formatDateKoreanShort, TOAST_MESSAGES } from '../constants';

interface ReportCardProps {
  report: WeeklyReportData;
  tone: MessageTone;
  styleTemplate: ReportStyleTemplate;
  onClose?: () => void;
}

export function ReportCard({ report, tone, styleTemplate, onClose }: ReportCardProps) {
  const [copyMode, setCopyMode] = useState<'full' | 'short'>('full');
  const [showPreview, setShowPreview] = useState(false);
  
  const { student, period, categoryStats, overallAvgScore, analysis } = report;
  
  const scoreStats = categoryStats.filter(s => s.isScored);
  const textStats = categoryStats.filter(s => !s.isScored);
  
  const handleCopy = async () => {
    const text = copyMode === 'full' 
      ? generateReportText(report, tone, styleTemplate)
      : generateReportTextShort(report, tone, styleTemplate);
    
    const success = await copyToClipboard(text);
    
    if (success) {
      toast.success(TOAST_MESSAGES.REPORT_COPIED);
    } else {
      toast.error(TOAST_MESSAGES.REPORT_COPY_FAILED);
    }
  };
  
  const previewText = copyMode === 'full'
    ? generateReportText(report, tone, styleTemplate)
    : generateReportTextShort(report, tone, styleTemplate);
  
  // 템플릿별 게이지 렌더링
  const renderGauge = (score: number, category: string) => {
    switch (styleTemplate) {
      case 'simple':
        return (
          <span className="text-lg mr-1">{getScoreEmoji(score)}</span>
        );
      case 'block':
        return (
          <>
            <span className="text-lg mr-1">{getScoreEmoji(score)}</span>
            <span className="tracking-wider text-gray-400">{scoreToBlockGauge(score)}</span>
          </>
        );
      case 'slider':
        return (
          <>
            <span className="text-lg mr-1">{getScoreEmoji(score)}</span>
            <span className="tracking-wider text-gray-400">{scoreToSliderGauge(score)}</span>
          </>
        );
      case 'heart':
        return (
          <>
            <span className="text-lg mr-1">{getCategoryEmoji(category)}</span>
            <span className="tracking-wider">{scoreToHeartGauge(score)}</span>
          </>
        );
    }
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {student.name}
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {formatDateKoreanShort(period.startDate)} ~ {formatDateKoreanShort(period.endDate)}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* 본문 */}
      <div className="p-6 space-y-6">
        {/* 항목 변경 경고 (원장/교사용) */}
        {report.configChanges && report.configChanges.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  선택한 기간에 평가항목이 변경되었습니다
                </p>
                <div className="text-xs text-amber-700 space-y-1">
                  {report.configChanges.map((change, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="font-medium">
                        {new Date(change.changeDate).getMonth() + 1}/{new Date(change.changeDate).getDate()}
                      </span>
                      <span>부터:</span>
                      <span className="text-amber-600">{change.afterItems.join(', ')}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  💡 기간을 조정하면 항목별 통계가 더 정확해집니다
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* 점수형 항목 */}
        {scoreStats.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-lg">📊</span> 항목별 성취도
            </h4>
            <div className="space-y-2">
              {scoreStats.map((stat, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {renderGauge(stat.avgScore, stat.statsCategory)}
                  <span className="w-20 text-sm text-gray-600 truncate">
                    {stat.statsCategory}
                  </span>
                  <span 
                    className="w-10 text-sm font-semibold text-right"
                    style={{ color: getScoreColor(stat.avgScore) }}
                  >
                    {styleTemplate === 'heart' ? `(${stat.avgScore})` : stat.avgScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 문장형 항목 */}
        {textStats.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <span className="text-lg">📋</span> 학습 태도
            </h4>
            <div className="space-y-2">
              {textStats.map((stat, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-600 truncate">
                    {stat.statsCategory}
                  </span>
                  <span className="text-sm text-gray-800">
                    {!stat.isScored && stat.topOption}
                  </span>
                  <span className="text-sm tracking-wider text-amber-500">
                    {!stat.isScored && countToDots(stat.topCount, stat.totalCount)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {!stat.isScored && `(${stat.topCount}/${stat.totalCount}회)`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 총평 */}
        {overallAvgScore !== null && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">총평</span>
              <span 
                className="text-2xl font-bold"
                style={{ color: getScoreColor(overallAvgScore) }}
              >
                {overallAvgScore}점
              </span>
            </div>
          </div>
        )}
        
        {/* 잘하는 점/노력할 점/목표 */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-start gap-2">
            <span className="text-lg">✅</span>
            <div>
              <span className="text-sm font-medium text-gray-700">잘하는 점: </span>
              <span className="text-sm text-gray-600">
                {analysis.strengths.length > 0 
                  ? analysis.strengths.join(', ')
                  : '-'}
              </span>
            </div>
          </div>
          
          {analysis.weaknesses.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-lg">⚡</span>
              <div>
                <span className="text-sm font-medium text-gray-700">노력할 점: </span>
                <span className="text-sm text-gray-600">
                  {analysis.weaknesses.join(', ')}
                </span>
              </div>
            </div>
          )}
          
          <div className="flex items-start gap-2">
            <span className="text-lg">🎯</span>
            <div>
              <span className="text-sm font-medium text-gray-700">
                {analysis.weaknesses.length > 0 ? '다음 목표: ' : ''}
              </span>
              <span className="text-sm text-gray-600">{analysis.nextGoal}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 푸터 - 복사 버튼 */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {/* 복사 모드 선택 */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setCopyMode('full')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                copyMode === 'full'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setCopyMode('short')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                copyMode === 'short'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              간단
            </button>
          </div>
          
          <div className="flex-1" />
          
          {/* 미리보기 토글 */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-white rounded-lg transition-colors"
          >
            {showPreview ? '미리보기 닫기' : '미리보기'}
          </button>
          
          {/* 복사 버튼 */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            복사
          </button>
        </div>
        
        {/* 미리보기 */}
        {showPreview && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
              {previewText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
