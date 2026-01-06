'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, ArrowLeft, Search } from 'lucide-react';
import type { Database } from '@/lib/database.types';
import { getRecentClassTransfers, type RecentClassTransfer } from '../students/actions/student.actions';

type DateFilter = '7' | '30' | '90' | 'all';

export default function ClassTransfersPage() {
  const router = useRouter();
  const [transfers, setTransfers] = useState<RecentClassTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('30');
  const [searchQuery, setSearchQuery] = useState('');

  const dateFilterTabs = [
    { value: '7' as const, label: '최근 7일' },
    { value: '30' as const, label: '최근 30일' },
    { value: '90' as const, label: '최근 90일' },
    { value: 'all' as const, label: '전체' },
  ];

  useEffect(() => {
    loadTransfers();
  }, [dateFilter]);

  const loadTransfers = async () => {
    setIsLoading(true);
    const days = dateFilter === 'all' ? 365 : parseInt(dateFilter);
    const result = await getRecentClassTransfers(days);
    if (result.ok && result.data) {
      setTransfers(result.data);
    }
    setIsLoading(false);
  };

  // 검색 필터링
  const filteredTransfers = useMemo(() => {
    if (!searchQuery.trim()) return transfers;
    const query = searchQuery.toLowerCase();
    return transfers.filter(t => 
      t.studentName.toLowerCase().includes(query) ||
      t.fromClassName.toLowerCase().includes(query) ||
      t.toClassName.toLowerCase().includes(query)
    );
  }, [transfers, searchQuery]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            뒤로가기
          </button>
          <h1 className="text-2xl font-bold text-[#1F2937] flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-[#6366F1]" />
            반 이동 내역
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">학생들의 반 이동 기록을 확인합니다</p>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 기간 필터 */}
              <div className="flex gap-1 p-1 bg-[#F3F4F6] rounded-lg">
                {dateFilterTabs.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setDateFilter(tab.value)}
                    className={`
                      px-3 py-1.5 text-sm font-medium rounded-md transition-all
                      ${dateFilter === tab.value
                        ? 'bg-white text-[#6366F1] shadow-sm'
                        : 'text-[#6B7280] hover:text-[#1F2937]'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 검색 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="학생명 또는 반명 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="mb-4 text-sm text-[#6B7280]">
          총 <span className="font-medium text-[#1F2937]">{filteredTransfers.length}</span>건의 반 이동
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block w-6 h-6 border-3 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                <p className="mt-2 text-sm text-[#6B7280]">로딩중...</p>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-[#6B7280]">
                  {searchQuery ? '검색 결과가 없습니다' : '해당 기간에 반 이동이 없습니다'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] hover:border-[#6366F1]/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#1F2937]">{transfer.studentName}</span>
                      <span className="text-xs text-[#9CA3AF]">{formatFullDate(transfer.date)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className="px-2 py-1 rounded-md text-white text-xs font-medium"
                        style={{ backgroundColor: transfer.fromClassColor || '#9CA3AF' }}
                      >
                        {transfer.fromClassName}
                      </span>
                      <span className="text-[#9CA3AF]">→</span>
                      <span
                        className="px-2 py-1 rounded-md text-white text-xs font-medium"
                        style={{ backgroundColor: transfer.toClassColor || '#10B981' }}
                      >
                        {transfer.toClassName}
                      </span>
                    </div>
                    
                    <div className="mt-2 text-xs text-[#9CA3AF]">
                      처리: {transfer.changedByName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
