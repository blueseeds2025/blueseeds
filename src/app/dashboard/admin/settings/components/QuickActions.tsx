// ============================================================================
// Quick Actions 컴포넌트
// ============================================================================
'use client';

import Link from 'next/link';

interface Props {
  stats: {
    teacherCount: number;
    studentCount: number;
  };
}

export default function QuickActions({ stats }: Props) {
  return (
    <section className="bg-stone-50 rounded-xl border border-stone-200 p-6">
      <h2 className="text-lg font-semibold text-stone-800 mb-4">⚡ 빠른 작업</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 선생님 추가 */}
        <Link
          href="/dashboard/admin/teachers"
          className="flex flex-col items-center p-4 bg-white rounded-xl border border-stone-200 hover:border-[#7C3AED]/30 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl">👩‍🏫</span>
          </div>
          <p className="text-sm font-medium text-stone-700">선생님 관리</p>
          <p className="text-xs text-stone-400">{stats.teacherCount}명</p>
        </Link>
        
        {/* 학생 추가 */}
        <Link
          href="/dashboard/admin/students"
          className="flex flex-col items-center p-4 bg-white rounded-xl border border-stone-200 hover:border-[#7C3AED]/30 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl">👨‍🎓</span>
          </div>
          <p className="text-sm font-medium text-stone-700">학생 관리</p>
          <p className="text-xs text-stone-400">{stats.studentCount}명</p>
        </Link>
        
        {/* 엑셀 업로드 */}
        <Link
          href="/dashboard/admin/students?action=upload"
          className="flex flex-col items-center p-4 bg-white rounded-xl border border-stone-200 hover:border-[#7C3AED]/30 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-sm font-medium text-stone-700">엑셀 업로드</p>
          <p className="text-xs text-stone-400">학생 일괄 등록</p>
        </Link>
        
        {/* 리포트 */}
        <Link
          href="/dashboard/admin/reports"
          className="flex flex-col items-center p-4 bg-white rounded-xl border border-stone-200 hover:border-[#7C3AED]/30 hover:shadow-md transition-all"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-2">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-sm font-medium text-stone-700">리포트</p>
          <p className="text-xs text-stone-400">주간/월간</p>
        </Link>
      </div>
    </section>
  );
}
