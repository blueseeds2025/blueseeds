// ============================================================================
// 리포트 생성 모달 (템플릿은 학원 설정에서 가져옴)
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import {
  createMonthlyReport,
  createMonthlyReportsForClass,
  getStudentsForMonthlyReport, 
  getMonthlyTemplateFromSettings,
} from '../actions/monthly-report.actions';
import { TEMPLATE_INFO, type TemplateType } from '@/types/monthly-report.types';
import { toast } from 'sonner';

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classes: { id: string; name: string }[];
}

type CreateMode = 'single' | 'batch';

export default function CreateReportModal({
  isOpen,
  onClose,
  onSuccess,
  classes,
}: CreateReportModalProps) {
  // 상태
  const [mode, setMode] = useState<CreateMode>('single');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [students, setStudents] = useState<{ id: string; name: string; class_name?: string }[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [templateType, setTemplateType] = useState<TemplateType>(1);
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  
  // 학원 설정에서 템플릿 가져오기
  useEffect(() => {
    if (isOpen) {
      loadTemplateFromSettings();
    }
  }, [isOpen]);
  
  async function loadTemplateFromSettings() {
    setLoadingTemplate(true);
    const result = await getMonthlyTemplateFromSettings();
    if (result.ok && result.data) {
      setTemplateType(result.data.templateType);
    }
    setLoadingTemplate(false);
  }
  
  // 반 선택 시 학생 목록 로드
  useEffect(() => {
    if (mode === 'single' && selectedClass) {
      loadStudents(selectedClass);
    } else if (mode === 'single' && !selectedClass) {
      loadStudents();
    }
  }, [mode, selectedClass]);
  
  async function loadStudents(classId?: string) {
    setLoadingStudents(true);
    const result = await getStudentsForMonthlyReport(classId);
    if (result.ok && result.data) {
      setStudents(result.data);
    }
    setLoadingStudents(false);
  }
  
  // 생성 핸들러
  async function handleCreate() {
    setLoading(true);
    
    try {
      if (mode === 'single') {
        // 개별 생성
        if (!selectedStudent) {
          toast.error('학생을 선택해주세요.');
          setLoading(false);
          return;
        }
        
        const result = await createMonthlyReport({
          student_id: selectedStudent,
          report_year: year,
          report_month: month,
          template_type: templateType,
        });
        
        if (result.ok) {
          toast.success('리포트가 생성되었습니다.');
          onSuccess();
        } else {
          toast.error(result.message || '생성에 실패했습니다.');
        }
      } else {
        // 일괄 생성
        if (!selectedClass) {
          toast.error('반을 선택해주세요.');
          setLoading(false);
          return;
        }
        
        const result = await createMonthlyReportsForClass(
          selectedClass,
          year,
          month,
          templateType
        );
        
        if (result.ok && result.data) {
          const { created, skipped, errors } = result.data;
          if (created > 0) {
            toast.success(`${created}명의 리포트가 생성되었습니다.`);
          }
          if (skipped > 0) {
            toast.info(`${skipped}명은 이미 리포트가 있어 건너뛰었습니다.`);
          }
          if (errors.length > 0) {
            toast.error(`${errors.length}건의 오류가 발생했습니다.`);
          }
          onSuccess();
        } else {
          toast.error(result.message || '생성에 실패했습니다.');
        }
      }
    } finally {
      setLoading(false);
    }
  }
  
  // 모달 닫기
  function handleClose() {
    setMode('single');
    setSelectedClass('');
    setSelectedStudent('');
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth() + 1);
    onClose();
  }
  
  if (!isOpen) return null;
  
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  
  // 현재 선택된 템플릿 정보
  const currentTemplate = TEMPLATE_INFO.find(t => t.type === templateType);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 백드롭 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      
      {/* 모달 */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-800">월간 리포트 생성</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* 바디 */}
        <div className="p-6 space-y-6">
          {/* 생성 모드 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">생성 방식</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === 'single'
                    ? 'border-[#6366F1] bg-[#6366F1]/5'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <p className={`font-medium ${mode === 'single' ? 'text-[#6366F1]' : 'text-stone-700'}`}>
                  개별 생성
                </p>
                <p className="text-sm text-stone-500 mt-1">학생 1명씩 선택</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  mode === 'batch'
                    ? 'border-[#6366F1] bg-[#6366F1]/5'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <p className={`font-medium ${mode === 'batch' ? 'text-[#6366F1]' : 'text-stone-700'}`}>
                  일괄 생성
                </p>
                <p className="text-sm text-stone-500 mt-1">반 전체 학생</p>
              </button>
            </div>
          </div>
          
          {/* 반 선택 */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              반 선택 {mode === 'batch' && <span className="text-red-500">*</span>}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedStudent('');
              }}
              className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
            >
              <option value="">
                {mode === 'single' ? '전체 (반 선택 안함)' : '반을 선택하세요'}
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          {/* 학생 선택 (개별 모드) */}
          {mode === 'single' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                학생 선택 <span className="text-red-500">*</span>
              </label>
              {loadingStudents ? (
                <div className="px-4 py-3 bg-stone-50 rounded-xl text-sm text-stone-500">
                  학생 목록 로딩 중...
                </div>
              ) : students.length === 0 ? (
                <div className="px-4 py-3 bg-stone-50 rounded-xl text-sm text-stone-500">
                  학생이 없습니다
                </div>
              ) : (
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                >
                  <option value="">학생을 선택하세요</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.class_name && `(${s.class_name})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          
          {/* 기간 선택 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">연도</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">월</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* 템플릿 표시 (읽기 전용) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">적용 템플릿</label>
              <a 
                href="/dashboard/admin/settings?tab=academy"
                className="text-xs text-[#6366F1] hover:underline"
              >
                변경하기 →
              </a>
            </div>
            {loadingTemplate ? (
              <div className="p-4 bg-stone-50 rounded-xl animate-pulse">
                <div className="h-5 w-32 bg-stone-200 rounded mb-2" />
                <div className="h-4 w-48 bg-stone-200 rounded" />
              </div>
            ) : currentTemplate ? (
              <div className="p-4 bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-[#6366F1]">
                    {currentTemplate.type}. {currentTemplate.name}
                  </p>
                  <span className="text-xs text-stone-400">{currentTemplate.target}</span>
                </div>
                <p className="text-sm text-stone-500 mt-1">{currentTemplate.description}</p>
              </div>
            ) : (
              <div className="p-4 bg-stone-50 rounded-xl text-sm text-stone-500">
                템플릿 정보를 불러올 수 없습니다
              </div>
            )}
          </div>
        </div>
        
        {/* 푸터 */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-stone-200 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 text-stone-600 hover:bg-stone-100 rounded-lg font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || loadingTemplate}
            className="px-6 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-stone-300 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {mode === 'single' ? '생성하기' : '일괄 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
