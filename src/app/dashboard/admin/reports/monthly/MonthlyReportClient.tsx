// ============================================================================
// 월간 리포트 클라이언트 컴포넌트
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMonthlyReports,
  getClassesForMonthlyReport,
  deleteMonthlyReport,
} from './actions/monthly-report.actions';
import type {
  MonthlyReportWithStudent,
  MonthlyReportFilter,
  ReportStatus,
} from '@/types/monthly-report.types';
import { STATUS_INFO, TEMPLATE_INFO } from '@/types/monthly-report.types';
import ReportCard from './components/ReportCard';
import CreateReportModal from './components/CreateReportModal';
import { toast } from 'sonner';

export default function MonthlyReportClient() {
  const router = useRouter();
  
  // 상태
  const [reports, setReports] = useState<MonthlyReportWithStudent[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // 필터
  const [filter, setFilter] = useState<MonthlyReportFilter>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });
  
  // 초기 데이터 로드
  useEffect(() => {
    loadData();
  }, [filter]);
  
  useEffect(() => {
    loadClasses();
  }, []);
  
  async function loadData() {
    setLoading(true);
    const result = await getMonthlyReports(filter);
    if (result.ok) {
      setReports(result.data.reports);
    } else {
      toast.error(result.message || '데이터를 불러오는데 실패했습니다.');
    }
    setLoading(false);
  }
  
  async function loadClasses() {
    const result = await getClassesForMonthlyReport();
    if (result.ok) {
      setClasses(result.data);
    }
  }
  
  // 삭제 핸들러
  async function handleDelete(reportId: string) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    const result = await deleteMonthlyReport(reportId);
    if (result.ok) {
      toast.success('리포트가 삭제되었습니다.');
      loadData();
    } else {
      toast.error(result.message || '삭제에 실패했습니다.');
    }
  }
  
  // 연도 옵션 생성
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  
  // 월 옵션 생성
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  
  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">월간 리포트</h1>
          <p className="text-sm text-stone-500 mt-1">
            학생별 월간 학습 리포트를 생성하고 관리합니다
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          리포트 생성
        </button>
      </div>
      
      {/* 필터 */}
      <div className="flex flex-wrap gap-4 p-4 bg-stone-50 rounded-xl">
        {/* 연도 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600">연도</label>
          <select
            value={filter.year || currentYear}
            onChange={(e) => setFilter({ ...filter, year: parseInt(e.target.value) })}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
        </div>
        
        {/* 월 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600">월</label>
          <select
            value={filter.month || ''}
            onChange={(e) => setFilter({ ...filter, month: e.target.value ? parseInt(e.target.value) : undefined })}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
          >
            <option value="">전체</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}월</option>
            ))}
          </select>
        </div>
        
        {/* 상태 */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600">상태</label>
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter({ ...filter, status: e.target.value as ReportStatus || undefined })}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]"
          >
            <option value="">전체</option>
            {Object.entries(STATUS_INFO).map(([key, info]) => (
              <option key={key} value={key}>{info.label}</option>
            ))}
          </select>
        </div>
        
        {/* 초기화 */}
        <button
          onClick={() => setFilter({ year: currentYear, month: new Date().getMonth() + 1 })}
          className="px-3 py-2 text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
        >
          초기화
        </button>
      </div>
      
      {/* 통계 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_INFO).map(([key, info]) => {
          const count = reports.filter((r) => r.status === key).length;
          return (
            <div
              key={key}
              className="p-4 bg-white rounded-xl border border-stone-200 cursor-pointer hover:border-[#7C3AED]/30 transition-colors"
              onClick={() => setFilter({ ...filter, status: key as ReportStatus })}
            >
              <p className="text-sm text-stone-500">{info.label}</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{count}</p>
            </div>
          );
        })}
      </div>
      
      {/* 리포트 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-stone-500">리포트가 없습니다</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 text-[#7C3AED] hover:bg-[#7C3AED]/5 rounded-lg font-medium transition-colors"
          >
            + 첫 리포트 생성하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onEdit={() => router.push(`/dashboard/admin/reports/monthly/${report.id}`)}
              onDelete={() => handleDelete(report.id)}
            />
          ))}
        </div>
      )}
      
      {/* 생성 모달 */}
      <CreateReportModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          setIsCreateModalOpen(false);
          loadData();
        }}
        classes={classes}
      />
    </div>
  );
}