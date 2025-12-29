'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Calendar, UserX } from 'lucide-react';
import type { Database }from '@/lib/supabase/types';

interface TodayAbsent {
  studentId: string;
  studentName: string;
  className: string;
  reason: string;
  needsMakeup: boolean;
  monthlyAbsenceCount: number;
}

interface PendingMakeup {
  studentName: string;
  className: string;
  absenceDate: string;
  reason: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    todayFeeds: 0,
    pendingMakeups: 0,
  });
  const [todayAbsents, setTodayAbsents] = useState<TodayAbsent[]>([]);
  const [pendingMakeupList, setPendingMakeupList] = useState<PendingMakeup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    
    const today = new Date().toISOString().split('T')[0];
    
    // 학생 수
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    // 교사 수
    const { count: teacherCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher');

    // 오늘 작성 피드 수
    const { count: todayFeedCount } = await supabase
      .from('student_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('feed_date', today);

    // 대기중 보강 수
    const { count: pendingCount } = await supabase
      .from('makeup_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    setStats({
      totalStudents: studentCount || 0,
      totalTeachers: teacherCount || 0,
      todayFeeds: todayFeedCount || 0,
      pendingMakeups: pendingCount || 0,
    });

    // 오늘 결석자 목록
    const { data: absentsData } = await supabase
      .from('student_feeds')
      .select(`
        student_id,
        class_id,
        absence_reason,
        needs_makeup
      `)
      .eq('feed_date', today)
      .eq('attendance_status', 'absent');

    if (absentsData && absentsData.length > 0) {
      const studentIds = [...new Set(absentsData.map(a => a.student_id))];
      const classIds = [...new Set(absentsData.map(a => a.class_id))];

      // 이번달 시작일
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

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
          .lte('feed_date', today),
      ]);

      const studentMap = new Map(studentsRes.data?.map(s => [s.id, s.name]) || []);
      const classMap = new Map(classesRes.data?.map(c => [c.id, c.name]) || []);
      
      // 학생별 이번달 결석 횟수 계산
      const absenceCountMap = new Map<string, number>();
      monthlyAbsencesRes.data?.forEach(item => {
        const count = absenceCountMap.get(item.student_id) || 0;
        absenceCountMap.set(item.student_id, count + 1);
      });

      setTodayAbsents(absentsData.map(a => ({
        studentId: a.student_id,
        studentName: studentMap.get(a.student_id) || '알 수 없음',
        className: classMap.get(a.class_id) || '알 수 없음',
        reason: a.absence_reason || '-',
        needsMakeup: a.needs_makeup || false,
        monthlyAbsenceCount: absenceCountMap.get(a.student_id) || 0,
      })));
    }

    // 보강 대기 목록 (최근 5개)
    const { data: makeupData } = await supabase
      .from('makeup_tickets')
      .select('student_id, class_id, absence_date, absence_reason')
      .eq('status', 'pending')
      .order('absence_date', { ascending: false })
      .limit(5);

    if (makeupData && makeupData.length > 0) {
      const studentIds = [...new Set(makeupData.map(m => m.student_id))];
      const classIds = [...new Set(makeupData.map(m => m.class_id))];

      const [studentsRes, classesRes] = await Promise.all([
        supabase.from('students').select('id, name').in('id', studentIds),
        supabase.from('classes').select('id, name').in('id', classIds),
      ]);

      const studentMap = new Map(studentsRes.data?.map(s => [s.id, s.name]) || []);
      const classMap = new Map(classesRes.data?.map(c => [c.id, c.name]) || []);

      setPendingMakeupList(makeupData.map(m => ({
        studentName: studentMap.get(m.student_id) || '알 수 없음',
        className: classMap.get(m.class_id) || '알 수 없음',
        absenceDate: m.absence_date,
        reason: m.absence_reason || '-',
      })));
    }

    setIsLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const statCards = [
    {
      title: '전체 학생',
      value: stats.totalStudents,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: '전체 교사',
      value: stats.totalTeachers,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: '오늘 작성 피드',
      value: stats.todayFeeds,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: '대기중 보강',
      value: stats.pendingMakeups,
      icon: Calendar,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      onClick: () => router.push('/dashboard/absence'),
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">원장 대시보드</h1>
      
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={index} 
              className={stat.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              onClick={stat.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 오늘의 결석자 & 보강 대기 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 오늘의 결석자 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-500" />
              오늘의 결석자
            </CardTitle>
            <span className="text-sm text-gray-500">{todayAbsents.length}명</span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-gray-500">로딩중...</div>
            ) : todayAbsents.length === 0 ? (
              <div className="text-sm text-gray-500">오늘 결석자가 없습니다 🎉</div>
            ) : (
              <div className="space-y-2">
                {todayAbsents.map((absent, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      absent.monthlyAbsenceCount >= 4 
                        ? 'bg-red-50 border border-red-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{absent.studentName}</span>
                      <span className="text-sm text-gray-500">{absent.className}</span>
                      {absent.monthlyAbsenceCount >= 4 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-600 text-white rounded-full">
                          ⚠️ 이번달 {absent.monthlyAbsenceCount}회
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{absent.reason}</span>
                      {absent.needsMakeup && (
                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-600 rounded-full">
                          보강
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 보강 대기 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-500" />
              보강 대기
            </CardTitle>
            <button 
              onClick={() => router.push('/dashboard/absence')}
              className="text-sm text-[#6366F1] hover:underline"
            >
              전체 보기 →
            </button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-gray-500">로딩중...</div>
            ) : pendingMakeupList.length === 0 ? (
              <div className="text-sm text-gray-500">대기중인 보강이 없습니다 ✓</div>
            ) : (
              <div className="space-y-2">
                {pendingMakeupList.map((makeup, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{makeup.studentName}</span>
                      <span className="text-sm text-gray-500 ml-2">{makeup.className}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{formatDate(makeup.absenceDate)}</span>
                      <span className="text-xs text-gray-500">{makeup.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 빠른 작업 & 최근 활동 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>빠른 작업</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button 
                onClick={() => router.push('/dashboard/admin/students')}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3"
              >
                <Users className="h-5 w-5 text-gray-600" />
                <span>새 학생 등록</span>
              </button>
              <button 
                onClick={() => router.push('/dashboard/notices')}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3"
              >
                <FileText className="h-5 w-5 text-gray-600" />
                <span>공지사항 작성</span>
              </button>
              <button 
                onClick={() => router.push('/dashboard/timetable')}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3"
              >
                <Calendar className="h-5 w-5 text-gray-600" />
                <span>시간표 관리</span>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              최근 활동 내역이 여기에 표시됩니다.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
