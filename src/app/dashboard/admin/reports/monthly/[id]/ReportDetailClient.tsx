// ============================================================================
// 리포트 상세/편집 클라이언트 컴포넌트
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMonthlyReport,
  updateMonthlyReport,
  updateReportStatus,
} from '../actions/monthly-report.actions';
import type {
  MonthlyReportWithStudent,
  UpdateMonthlyReportInput,
  ReportStatus,
} from '@/types/monthly-report.types';
import { STATUS_INFO, TEMPLATE_INFO } from '@/types/monthly-report.types';
import { toast } from 'sonner';

interface Props {
  reportId: string;
}

type TabType = 'data' | 'ai' | 'teacher' | 'preview';

export default function ReportDetailClient({ reportId }: Props) {
  const router = useRouter();
  
  // 상태
  const [report, setReport] = useState<MonthlyReportWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('data');
  
  // 편집 상태
  const [editData, setEditData] = useState<UpdateMonthlyReportInput>({});
  
  // 데이터 로드
  useEffect(() => {
    loadReport();
  }, [reportId]);
  
  async function loadReport() {
    setLoading(true);
    const result = await getMonthlyReport(reportId);
    if (result.ok) {
      setReport(result.data);
      setEditData({
        teacher_praise: result.data.teacher_praise,
        teacher_improve: result.data.teacher_improve,
        teacher_comment: result.data.teacher_comment,
        parent_message: result.data.parent_message,
        template_type: result.data.template_type,
      });
    } else {
      toast.error(result.message || '리포트를 불러오는데 실패했습니다.');
      router.push('/dashboard/admin/reports/monthly');
    }
    setLoading(false);
  }
  
  // 저장 핸들러
  async function handleSave() {
    if (!report) return;
    
    setSaving(true);
    const result = await updateMonthlyReport(report.id, editData);
    if (result.ok) {
      toast.success('저장되었습니다.');
      loadReport();
    } else {
      toast.error(result.message || '저장에 실패했습니다.');
    }
    setSaving(false);
  }
  
  // 상태 변경 핸들러
  async function handleStatusChange(status: ReportStatus) {
    if (!report) return;
    
    const result = await updateReportStatus(report.id, status);
    if (result.ok) {
      toast.success(`상태가 '${STATUS_INFO[status].label}'로 변경되었습니다.`);
      loadReport();
    } else {
      toast.error(result.message || '상태 변경에 실패했습니다.');
    }
  }
  
  if (loading) {
    return <div className="p-6 text-center text-stone-500">로딩 중...</div>;
  }
  
  if (!report) {
    return <div className="p-6 text-center text-stone-500">리포트를 찾을 수 없습니다.</div>;
  }
  
  const templateInfo = TEMPLATE_INFO.find((t) => t.type === report.template_type);
  
  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/admin/reports/monthly')}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-stone-800">
              {report.student?.name} - {report.report_year}년 {report.report_month}월
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              {templateInfo?.name} | 생성: {new Date(report.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* 상태 뱃지 */}
          <select
            value={report.status}
            onChange={(e) => handleStatusChange(e.target.value as ReportStatus)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border-0 focus:ring-2 focus:ring-[#7C3AED]/20 ${
              report.status === 'draft' ? 'bg-stone-100 text-stone-600' :
              report.status === 'generated' ? 'bg-blue-100 text-blue-700' :
              report.status === 'reviewed' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}
          >
            {Object.entries(STATUS_INFO).map(([key, info]) => (
              <option key={key} value={key}>{info.label}</option>
            ))}
          </select>
          
          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:bg-stone-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            저장
          </button>
        </div>
      </div>
      
      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl w-fit">
        {[
          { key: 'data', label: '📊 데이터' },
          { key: 'ai', label: '🤖 AI 코멘트' },
          { key: 'teacher', label: '✏️ 선생님 입력' },
          { key: 'preview', label: '👁️ 미리보기' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* 탭 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 데이터/입력 */}
        <div className="space-y-6">
          {activeTab === 'data' && (
            <>
              {/* 출석 요약 */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 mb-4">📅 출석 현황</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-stone-50 rounded-lg">
                    <p className="text-2xl font-bold text-stone-800">{report.attendance_summary?.total_days || 0}</p>
                    <p className="text-xs text-stone-500">전체</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{report.attendance_summary?.attended || 0}</p>
                    <p className="text-xs text-stone-500">출석</p>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{report.attendance_summary?.late || 0}</p>
                    <p className="text-xs text-stone-500">지각</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{report.attendance_summary?.absent || 0}</p>
                    <p className="text-xs text-stone-500">결석</p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-[#7C3AED]/5 rounded-lg text-center">
                  <p className="text-sm text-stone-600">출석률</p>
                  <p className="text-3xl font-bold text-[#7C3AED]">{report.attendance_summary?.rate || 0}%</p>
                </div>
              </div>
              
              {/* 점수 요약 */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 mb-4">📊 영역별 점수</h3>
                {Object.keys(report.score_summary || {}).length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-4">점수 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(report.score_summary || {}).map(([category, data]) => (
                      <div key={category}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-stone-600">{category}</span>
                          <span className="font-medium text-stone-800">{data.average}점</span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              data.average >= 90 ? 'bg-green-500' :
                              data.average >= 80 ? 'bg-blue-500' :
                              data.average >= 70 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${data.average}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* 진도 요약 */}
              <div className="bg-white rounded-xl border border-stone-200 p-5">
                <h3 className="font-semibold text-stone-800 mb-4">📚 진도 현황</h3>
                {(report.progress_summary || []).length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-4">진도 데이터가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {(report.progress_summary || []).map((item, idx) => (
                      <div key={idx} className="flex gap-3 p-2 hover:bg-stone-50 rounded-lg">
                        <span className="px-2 py-0.5 bg-[#7C3AED]/10 text-[#7C3AED] text-xs font-medium rounded">
                          {item.week}주차
                        </span>
                        <span className="text-sm text-stone-700">{item.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          
          {activeTab === 'ai' && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-stone-800">🤖 AI 생성 코멘트</h3>
                <button
                  className="px-3 py-1.5 text-sm text-[#7C3AED] hover:bg-[#7C3AED]/5 rounded-lg font-medium transition-colors"
                >
                  AI 코멘트 생성
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">학습 (Study)</label>
                  <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-700 min-h-[80px]">
                    {report.ai_study_comment || <span className="text-stone-400">AI 코멘트 미생성</span>}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">태도 (Attitude)</label>
                  <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-700 min-h-[80px]">
                    {report.ai_attitude_comment || <span className="text-stone-400">AI 코멘트 미생성</span>}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">출결 (Attendance)</label>
                  <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-700 min-h-[80px]">
                    {report.ai_attendance_comment || <span className="text-stone-400">AI 코멘트 미생성</span>}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">다음 목표</label>
                  <div className="p-3 bg-stone-50 rounded-lg text-sm text-stone-700 min-h-[60px]">
                    {report.ai_next_goal || <span className="text-stone-400">AI 코멘트 미생성</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'teacher' && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-semibold text-stone-800 mb-4">✏️ 선생님 입력</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">칭찬할 점</label>
                  <textarea
                    value={editData.teacher_praise || ''}
                    onChange={(e) => setEditData({ ...editData, teacher_praise: e.target.value })}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-none"
                    rows={3}
                    placeholder="이번 달 칭찬할 점을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">보완할 점</label>
                  <textarea
                    value={editData.teacher_improve || ''}
                    onChange={(e) => setEditData({ ...editData, teacher_improve: e.target.value })}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-none"
                    rows={3}
                    placeholder="다음 달 집중할 부분을 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">선생님 총평</label>
                  <textarea
                    value={editData.teacher_comment || ''}
                    onChange={(e) => setEditData({ ...editData, teacher_comment: e.target.value })}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-none"
                    rows={4}
                    placeholder="종합적인 코멘트를 입력하세요"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-stone-600 mb-2">학부모 메시지</label>
                  <textarea
                    value={editData.parent_message || ''}
                    onChange={(e) => setEditData({ ...editData, parent_message: e.target.value })}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] resize-none"
                    rows={3}
                    placeholder="학부모님께 전달할 메시지를 입력하세요"
                  />
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'preview' && (
            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h3 className="font-semibold text-stone-800 mb-4">👁️ 출력 옵션</h3>
              <div className="space-y-3">
                <button className="w-full p-3 border border-stone-200 rounded-lg text-left hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-colors">
                  <p className="font-medium text-stone-700">PDF 다운로드</p>
                  <p className="text-sm text-stone-500">리포트를 PDF로 저장합니다</p>
                </button>
                <button className="w-full p-3 border border-stone-200 rounded-lg text-left hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-colors">
                  <p className="font-medium text-stone-700">카카오톡 발송</p>
                  <p className="text-sm text-stone-500">학부모님께 카카오톡으로 발송합니다</p>
                </button>
                <button className="w-full p-3 border border-stone-200 rounded-lg text-left hover:border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 transition-colors">
                  <p className="font-medium text-stone-700">인쇄하기</p>
                  <p className="text-sm text-stone-500">리포트를 인쇄합니다</p>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* 오른쪽: 미리보기 */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 sticky top-6 h-fit">
          <h3 className="font-semibold text-stone-800 mb-4">📄 리포트 미리보기</h3>
          
          {/* 미니 프리뷰 */}
          <div className="border border-stone-200 rounded-lg p-4 bg-stone-50 min-h-[500px]">
            {/* 헤더 */}
            <div className="text-center pb-4 border-b border-stone-200 mb-4">
              <p className="text-xs text-stone-500">리드앤톡 영어수학학원</p>
              <p className="text-lg font-bold text-stone-800 mt-1">
                {report.report_year}년 {report.report_month}월 학습 리포트
              </p>
            </div>
            
            {/* 학생 정보 */}
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg mb-4">
              <div className="w-10 h-10 bg-[#7C3AED]/10 rounded-full flex items-center justify-center text-[#7C3AED] font-bold">
                {report.student?.name?.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-stone-800">{report.student?.name}</p>
                <p className="text-xs text-stone-500">{templateInfo?.name}</p>
              </div>
            </div>
            
            {/* 출석률 */}
            <div className="p-3 bg-white rounded-lg mb-3">
              <p className="text-xs text-stone-500 mb-1">출석률</p>
              <p className="text-xl font-bold text-[#7C3AED]">{report.attendance_summary?.rate || 0}%</p>
            </div>
            
            {/* 점수 */}
            {Object.keys(report.score_summary || {}).length > 0 && (
              <div className="p-3 bg-white rounded-lg mb-3">
                <p className="text-xs text-stone-500 mb-2">영역별 점수</p>
                <div className="space-y-1.5">
                  {Object.entries(report.score_summary || {}).slice(0, 4).map(([cat, data]) => (
                    <div key={cat} className="flex justify-between text-xs">
                      <span className="text-stone-600">{cat}</span>
                      <span className="font-medium">{data.average}점</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 코멘트 */}
            {(editData.teacher_comment || report.ai_study_comment) && (
              <div className="p-3 bg-white rounded-lg">
                <p className="text-xs text-stone-500 mb-1">총평</p>
                <p className="text-xs text-stone-700 line-clamp-4">
                  {editData.teacher_comment || report.ai_study_comment}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}