'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Calendar, TrendingUp } from 'lucide-react';
import type { Database } from '@/lib/database.types';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    todayFeeds: 0,
    pendingMakeups: 0,
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // 학생 수
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    // 교사 수
    const { count: teacherCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'teacher');

    setStats({
      totalStudents: studentCount || 0,
      totalTeachers: teacherCount || 0,
      todayFeeds: 0, // 나중에 구현
      pendingMakeups: 0, // 나중에 구현
    });
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
            <Card key={index}>
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

      {/* 빠른 작업 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>빠른 작업</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <Users className="h-5 w-5 text-gray-600" />
                <span>새 학생 등록</span>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <span>공지사항 작성</span>
              </button>
              <button className="w-full text-left p-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
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