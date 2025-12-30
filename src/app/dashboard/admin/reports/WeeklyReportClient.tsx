'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import type { WeeklyReportData, MessageTone, ReportStyleTemplate } from '@/types/report';
import { STYLE_TEMPLATE_INFO } from '@/types/report';
import { 
  getReportSettings, 
  getClassesForReport, 
  getStudentsForReport,
  generateWeeklyReport,
} from './actions/report.actions';
import { ReportCard, PeriodSelector, StudentSelector } from './components';
import { getDateRange, TOAST_MESSAGES } from './constants';

interface ReportSettings {
  strengthThreshold: number;
  weaknessThreshold: number;
  messageTone: MessageTone;
}

type ReportTab = 'weekly' | 'monthly';

export function WeeklyReportClient() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<ReportTab>('weekly');
  // 설정 상태
  const [settings, setSettings] = useState<ReportSettings>({
    strengthThreshold: 80,
    weaknessThreshold: 75,
    messageTone: 'friendly',
  });
  
  // 스타일 템플릿 상태
  const [styleTemplate, setStyleTemplate] = useState<ReportStyleTemplate>('simple');
  
  // 데이터 상태
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string; display_code: string | null }[]>([]);
  
  // 선택 상태
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 리포트 상태
  const [reports, setReports] = useState<WeeklyReportData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // 로딩 상태
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  
  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      // 설정 로드
      const settingsResult = await getReportSettings();
      if (settingsResult.ok) {
        setSettings({
          strengthThreshold: settingsResult.data.strength_threshold,
          weaknessThreshold: settingsResult.data.weakness_threshold,
          messageTone: settingsResult.data.messageTone,
        });
      }
      setIsLoadingSettings(false);
      
      // 반 목록 로드
      const classesResult = await getClassesForReport();
      if (classesResult.ok) {
        setClasses(classesResult.data);
      }
      setIsLoadingClasses(false);
      
      // 기본 기간 설정 (최근 2주)
      const { startDate: defaultStart, endDate: defaultEnd } = getDateRange('2weeks');
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
    };
    
    loadInitialData();
  }, []);
  
  // 반 선택 시 학생 로드
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    
    const loadStudents = async () => {
      setIsLoadingStudents(true);
      const result = await getStudentsForReport(selectedClassId);
      if (result.ok) {
        setStudents(result.data);
      }
      setIsLoadingStudents(false);
    };
    
    loadStudents();
  }, [selectedClassId]);
  
  // 기간 변경 핸들러
  const handleDateChange = useCallback((newStart: string, newEnd: string) => {
    setStartDate(newStart);
    setEndDate(newEnd);
  }, []);
  
  // 리포트 생성
  const handleGenerateReports = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error(TOAST_MESSAGES.NO_STUDENT_SELECTED);
      return;
    }
    
    if (!startDate || !endDate) {
      toast.error(TOAST_MESSAGES.NO_DATE_SELECTED);
      return;
    }
    
    setIsGenerating(true);
    setReports([]);
    
    const newReports: WeeklyReportData[] = [];
    let errorCount = 0;
    let hasConfigChanges = false;
    
    for (const studentId of selectedStudentIds) {
      const result = await generateWeeklyReport({
        studentId,
        startDate,
        endDate,
      });
      
      if (result.ok) {
        newReports.push(result.data);
        if (result.data.configChanges && result.data.configChanges.length > 0) {
          hasConfigChanges = true;
        }
      } else {
        errorCount++;
        console.error(`리포트 생성 실패 (${studentId}):`, result.message);
      }
    }
    
    setReports(newReports);
    setIsGenerating(false);
    
    if (newReports.length > 0) {
      toast.success(`${newReports.length}명의 리포트가 생성되었습니다`);
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount}명은 데이터가 없어 생성되지 않았습니다`);
    }
    
    // 항목 변경 경고
    if (hasConfigChanges) {
      toast.warning(
        '선택한 기간에 평가항목이 변경되었습니다. 리포트 미리보기에서 변경 시점을 확인하세요.',
        { duration: 6000 }
      );
    }
  };
  
  // 개별 리포트 닫기
  const handleCloseReport = (studentId: string) => {
    setReports(reports.filter(r => r.student.id !== studentId));
  };
  
  const isLoading = isLoadingSettings || isLoadingClasses;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-indigo-600" />
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
        <p className="text-gray-600 mt-1">학생별 학습 성과를 확인하고 카톡으로 발송하세요</p>
      </div>
      
      {/* 탭 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'weekly'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            주간 리포트
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'monthly'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            월간 AI 리포트
            <Lock className="w-3.5 h-3.5" />
          </button>
        </nav>
      </div>
      
      {/* 탭 내용 */}
      {activeTab === 'weekly' ? (
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
                    ? 'border-indigo-500 bg-indigo-50'
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
                    {tmpl === 'slider' && '🟢 ━━━━━━━━●─'}
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
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
      ) : (
        /* 월간 AI 리포트 (Premium - 잠금) */
        <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            월간 AI 리포트
          </h3>
          <p className="text-gray-500 mb-4">
            AI가 학생별 학습 데이터를 분석하여<br />
            맞춤형 서술 리포트를 자동으로 생성합니다.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-sm font-medium rounded-full">
            <span>Premium 기능</span>
            <span className="text-xs opacity-75">Coming Soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
