'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/ssr';
import { 
  getMakeupTickets, 
  completeTicket, 
  reopenTicket,
  MakeupTicket 
} from './makeup.actions';
import type { Database } from '@/lib/database.types';

interface AbsentStudent {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  feedDate: string;
  absenceReason: string | null;
  needsMakeup: boolean;
  monthlyAbsenceCount: number;
}

type DateFilter = 'today' | 'week' | 'month' | 'custom';

export default function AbsenceMakeupPage() {
  // 결석자 상태
  const [absents, setAbsents] = useState<AbsentStudent[]>([]);
  const [absentsLoading, setAbsentsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // 보강 상태
  const [tickets, setTickets] = useState<MakeupTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [makeupDateFilter, setMakeupDateFilter] = useState<DateFilter>('month');
  const [makeupStartDate, setMakeupStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [makeupEndDate, setMakeupEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 결석자 로드
  useEffect(() => {
    loadAbsents();
  }, [dateFilter, customStartDate, customEndDate]);

  // 보강 티켓 로드
  useEffect(() => {
    loadTickets();
  }, [filter, makeupDateFilter, makeupStartDate, makeupEndDate]);

  const loadAbsents = async () => {
    setAbsentsLoading(true);
    
    // 기간 계산
    const today = new Date();
    let startDate: string;
    let endDate: string;
    
    switch (dateFilter) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        startDate = weekAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'custom':
        startDate = customStartDate;
        endDate = customEndDate;
        break;
      default:
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
    }
    
    const { data: feeds, error } = await supabase
      .from('student_feeds')
      .select('id, student_id, class_id, feed_date, absence_reason, needs_makeup')
      .gte('feed_date', startDate)
      .lte('feed_date', endDate)
      .eq('attendance_status', 'absent')
      .order('feed_date', { ascending: false });

    if (error) {
      toast.error('결석자 목록을 불러오는데 실패했습니다');
      setAbsentsLoading(false);
      return;
    }

    if (!feeds || feeds.length === 0) {
      setAbsents([]);
      setAbsentsLoading(false);
      return;
    }

    // 학생, 반 정보 조회
    const studentIds = [...new Set(feeds.map(f => f.student_id))];
    const classIds = [...new Set(feeds.map(f => f.class_id))];

    // 이번달 시작일 계산
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      .toISOString().split('T')[0];
    const monthEnd = currentMonth.toISOString().split('T')[0];

    const [studentsRes, classesRes, monthlyAbsencesRes] = await Promise.all([
      supabase.from('students').select('id, name').in('id', studentIds),
      supabase.from('classes').select('id, name').in('id', classIds),
      // 이번달 결석 횟수 조회
      supabase
        .from('student_feeds')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('attendance_status', 'absent')
        .gte('feed_date', monthStart)
        .lte('feed_date', monthEnd),
    ]);

    const studentMap = new Map(studentsRes.data?.map(s => [s.id, s.name]) || []);
    const classMap = new Map(classesRes.data?.map(c => [c.id, c.name]) || []);
    
    // 학생별 이번달 결석 횟수 계산
    const absenceCountMap = new Map<string, number>();
    monthlyAbsencesRes.data?.forEach(item => {
      const count = absenceCountMap.get(item.student_id) || 0;
      absenceCountMap.set(item.student_id, count + 1);
    });

    setAbsents(feeds.map(f => ({
      id: f.id,
      studentId: f.student_id,
      studentName: studentMap.get(f.student_id) || '알 수 없음',
      className: classMap.get(f.class_id) || '알 수 없음',
      feedDate: f.feed_date,
      absenceReason: f.absence_reason,
      needsMakeup: f.needs_makeup || false,
      monthlyAbsenceCount: absenceCountMap.get(f.student_id) || 0,
    })));

    setAbsentsLoading(false);
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    
    // 날짜 범위 계산
    const today = new Date();
    let startDate: string;
    let endDate: string;
    
    switch (makeupDateFilter) {
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = startDate;
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        startDate = weekAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'custom':
        startDate = makeupStartDate;
        endDate = makeupEndDate;
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
    }
    
    // 상태 필터 쿼리 구성
    let query = supabase
      .from('makeup_tickets')
      .select('*')
      .gte('absence_date', startDate)
      .lte('absence_date', endDate)
      .order('absence_date', { ascending: false });
    
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    
    const { data: ticketData, error } = await query;
    
    if (error) {
      toast.error('보강 목록 로드 실패');
      setTicketsLoading(false);
      return;
    }
    
    if (!ticketData || ticketData.length === 0) {
      setTickets([]);
      setTicketsLoading(false);
      return;
    }
    
    // 학생, 반 정보 조회
    const studentIds = [...new Set(ticketData.map(t => t.student_id))];
    const classIds = [...new Set(ticketData.map(t => t.class_id))];
    
    const [studentsRes, classesRes] = await Promise.all([
      supabase.from('students').select('id, name').in('id', studentIds),
      supabase.from('classes').select('id, name').in('id', classIds),
    ]);
    
    const studentMap = new Map(studentsRes.data?.map(s => [s.id, s.name]) || []);
    const classMap = new Map(classesRes.data?.map(c => [c.id, c.name]) || []);
    
    setTickets(ticketData.map(t => ({
      id: t.id,
      studentId: t.student_id,
      studentName: studentMap.get(t.student_id) || '알 수 없음',
      classId: t.class_id,
      className: classMap.get(t.class_id) || '알 수 없음',
      absenceDate: t.absence_date,
      absenceReason: t.absence_reason,
      status: t.status as 'pending' | 'completed' | 'cancelled',
      completionNote: t.completion_note,
    })));
    
    setTicketsLoading(false);
  };

  // 완료 처리
  const handleComplete = async (ticketId: string) => {
    const note = noteInputs[ticketId]?.trim();
    if (!note) {
      toast.error('처리 내용을 입력해주세요');
      return;
    }

    setProcessingId(ticketId);
    const result = await completeTicket(ticketId, note);
    
    if (result.success) {
      toast.success('완료 처리되었습니다');
      loadTickets();
      setNoteInputs(prev => ({ ...prev, [ticketId]: '' }));
    } else {
      toast.error(result.error || '처리 실패');
    }
    setProcessingId(null);
  };

  // 되돌리기
  const handleReopen = async (ticketId: string) => {
    setProcessingId(ticketId);
    const result = await reopenTicket(ticketId);
    
    if (result.success) {
      toast.success('대기 상태로 되돌렸습니다');
      loadTickets();
    } else {
      toast.error(result.error || '처리 실패');
    }
    setProcessingId(null);
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${month}/${day} (${dayOfWeek})`;
  };

  // 날짜 표시 (헤더용)
  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1F2937]">결석·보강 관리</h1>
          <p className="text-sm text-[#6B7280] mt-1">결석 현황과 보강 처리를 한눈에</p>
        </div>

        {/* 2컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 왼쪽: 결석자 목록 */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB] bg-[#FEF2F2]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[#DC2626] flex items-center gap-2">
                  📋 결석자 목록
                </h2>
                <span className="text-sm text-[#991B1B]">{absents.length}건</span>
              </div>
              
              {/* 기간 선택 탭 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { value: 'today', label: '오늘' },
                  { value: 'week', label: '이번주' },
                  { value: 'month', label: '이번달' },
                  { value: 'custom', label: '기간선택' },
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setDateFilter(tab.value as DateFilter)}
                    className={`
                      px-3 py-1 rounded-lg text-xs font-medium transition-colors
                      ${dateFilter === tab.value
                        ? 'bg-[#DC2626] text-white'
                        : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* 기간 선택 입력 */}
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                  />
                  <span className="text-sm text-[#6B7280]">~</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30"
                  />
                </div>
              )}
            </div>

            <div className="p-4 max-h-[600px] overflow-y-auto">
              {absentsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block w-6 h-6 border-3 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
                  <p className="mt-2 text-sm text-[#6B7280]">로딩중...</p>
                </div>
              ) : absents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-[#6B7280]">결석자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    // 학생별 첫 번째 등장 여부 추적
                    const shownStudents = new Set<string>();
                    return absents.map(absent => {
                      const isFirstAppearance = !shownStudents.has(absent.studentId);
                      if (absent.monthlyAbsenceCount >= 4) {
                        shownStudents.add(absent.studentId);
                      }
                      return (
                        <div
                          key={absent.id}
                          className={`p-3 rounded-lg border ${
                            absent.monthlyAbsenceCount >= 4 
                              ? 'bg-[#FEF2F2] border-[#FECACA]' 
                              : 'bg-[#F9FAFB] border-[#E5E7EB]'
                          }`}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9CA3AF] font-mono">{formatDate(absent.feedDate)}</span>
                              <span className="font-medium text-[#1F2937]">{absent.studentName}</span>
                              <span className="text-sm text-[#6B7280]">{absent.className}</span>
                              {absent.monthlyAbsenceCount >= 4 && (
                                isFirstAppearance ? (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-[#DC2626] text-white rounded-full">
                                    ⚠️ {absent.monthlyAbsenceCount}회
                                  </span>
                                ) : (
                                  <span className="text-sm">⚠️</span>
                                )
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#6B7280]">{absent.absenceReason || '-'}</span>
                              {absent.needsMakeup ? (
                                <span className="px-2 py-0.5 text-xs font-medium bg-[#FEF3C7] text-[#92400E] rounded-full">
                                  보강필요
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-medium bg-[#E5E7EB] text-[#6B7280] rounded-full">
                                  보강불필요
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

            {/* 결석자 통계 */}
            {!absentsLoading && absents.length > 0 && (
              <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
                <div className="flex justify-around text-center text-sm">
                  <div>
                    <p className="font-bold text-[#DC2626]">{absents.length}</p>
                    <p className="text-[#6B7280]">전체 결석</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#F59E0B]">{absents.filter(a => a.needsMakeup).length}</p>
                    <p className="text-[#6B7280]">보강 필요</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#6B7280]">{absents.filter(a => !a.needsMakeup).length}</p>
                    <p className="text-[#6B7280]">보강 불필요</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 보강 대기 */}
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="p-4 border-b border-[#E5E7EB] bg-[#FEF3C7]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[#92400E] flex items-center gap-2">
                  📅 보강 관리
                </h2>
                <span className="text-sm text-[#92400E]">{tickets.length}건</span>
              </div>
              
              {/* 날짜 필터 탭 */}
              <div className="flex flex-wrap gap-2 mb-2">
                {[
                  { value: 'today', label: '오늘' },
                  { value: 'week', label: '이번주' },
                  { value: 'month', label: '이번달' },
                  { value: 'custom', label: '기간선택' },
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setMakeupDateFilter(tab.value as DateFilter)}
                    className={`
                      px-3 py-1 rounded-lg text-xs font-medium transition-colors
                      ${makeupDateFilter === tab.value
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* 기간 선택 입력 */}
              {makeupDateFilter === 'custom' && (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="date"
                    value={makeupStartDate}
                    onChange={(e) => setMakeupStartDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                  <span className="text-sm text-[#6B7280]">~</span>
                  <input
                    type="date"
                    value={makeupEndDate}
                    onChange={(e) => setMakeupEndDate(e.target.value)}
                    className="px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30"
                  />
                </div>
              )}
              
              {/* 상태 필터 탭 */}
              <div className="flex gap-2 mt-2">
                {[
                  { value: 'pending', label: '대기중' },
                  { value: 'completed', label: '완료' },
                  { value: 'all', label: '전체' },
                ].map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value as typeof filter)}
                    className={`
                      px-3 py-1 rounded-lg text-xs font-medium transition-colors
                      ${filter === tab.value
                        ? 'bg-[#6366F1] text-white'
                        : 'bg-white text-[#6B7280] hover:bg-[#F3F4F6]'
                      }
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 max-h-[600px] overflow-y-auto">
              {ticketsLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block w-6 h-6 border-3 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
                  <p className="mt-2 text-sm text-[#6B7280]">로딩중...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">✓</div>
                  <p className="text-[#6B7280]">
                    {filter === 'pending' ? '대기중인 보강이 없습니다' : '보강 내역이 없습니다'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className="p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-[#1F2937]">{ticket.studentName}</span>
                            {ticket.status === 'pending' ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FEF3C7] text-[#92400E]">
                                대기
                              </span>
                            ) : ticket.status === 'completed' ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#D1FAE5] text-[#065F46]">
                                완료
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#E5E7EB] text-[#6B7280]">
                                취소
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-[#6B7280]">
                            <span>{ticket.className}</span>
                            <span className="mx-1">·</span>
                            <span>{formatDate(ticket.absenceDate)} 결석</span>
                            {ticket.absenceReason && (
                              <>
                                <span className="mx-1">·</span>
                                <span>{ticket.absenceReason}</span>
                              </>
                            )}
                          </div>
                          {ticket.completionNote && (
                            <p className="text-sm text-[#059669] font-medium mt-1">
                              ✓ {ticket.completionNote}
                            </p>
                          )}
                        </div>

                        {/* 액션 */}
                        <div className="flex-shrink-0">
                          {ticket.status === 'pending' ? (
                            <div className="flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="예: 12/28 보강완료"
                                value={noteInputs[ticket.id] || ''}
                                onChange={(e) => setNoteInputs(prev => ({ 
                                  ...prev, 
                                  [ticket.id]: e.target.value 
                                }))}
                                className="w-36 px-2 py-1 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                              />
                              <button
                                onClick={() => handleComplete(ticket.id)}
                                disabled={processingId === ticket.id}
                                className="px-3 py-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                {processingId === ticket.id ? '처리중...' : '완료'}
                              </button>
                            </div>
                          ) : ticket.status === 'completed' ? (
                            <button
                              onClick={() => handleReopen(ticket.id)}
                              disabled={processingId === ticket.id}
                              className="px-2 py-1 text-xs text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                            >
                              되돌리기
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 보강 통계 */}
            {!ticketsLoading && (
              <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB]">
                <div className="flex justify-around text-center text-sm">
                  <div>
                    <p className="font-bold text-[#F59E0B]">
                      {tickets.filter(t => t.status === 'pending').length}
                    </p>
                    <p className="text-[#6B7280]">대기</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#10B981]">
                      {tickets.filter(t => t.status === 'completed').length}
                    </p>
                    <p className="text-[#6B7280]">완료</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#6B7280]">
                      {tickets.filter(t => t.status === 'cancelled').length}
                    </p>
                    <p className="text-[#6B7280]">취소</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}