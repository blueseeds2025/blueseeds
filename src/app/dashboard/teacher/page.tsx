'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Clock, CheckCircle, UserX, Calendar } from 'lucide-react';
import type { Database } from '@/lib/database.types';

export default function TeacherDashboard() {
  const [teacherName, setTeacherName] = useState('');
  
  // 오늘의 결석자 (TODO: DB에서 가져오기)
  const todayAbsences: { id: number; studentName: string; className: string; reason: string }[] = [];
  
  // 내 반 보강 현황 (TODO: DB에서 가져오기)
  const myMakeups: { id: number; studentName: string; originalDate: string; status: string; scheduledTime?: string }[] = [];
  
  // 오늘의 수업 일정 (TODO: DB에서 가져오기)
  const todaySchedule: { id: number; time: string; studentName: string; className: string; isMakeup?: boolean }[] = [];
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    getTeacherInfo();
  }, []);

  const getTeacherInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setTeacherName(profile.display_name);
      }
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">
        안녕하세요, {teacherName || '선생님'}!
      </h1>
      
      {/* 오늘의 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 수업</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaySchedule.length}</div>
            <p className="text-xs text-gray-600">명</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 결석</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAbsences.length}</div>
            <p className="text-xs text-gray-600">명</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">피드 작성</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-gray-600">건 완료</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">대기 보강</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myMakeups.filter(m => m.status === '미배정').length}</div>
            <p className="text-xs text-gray-600">건</p>
          </CardContent>
        </Card>
      </div>

      {/* 결석/보강 현황 (중요!) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 오늘 내 반 결석자 */}
        <Card className="border-red-200">
          <CardHeader className="pb-3 bg-red-50">
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              오늘 내 반 결석자
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {todayAbsences.length > 0 ? (
                todayAbsences.map((absence) => (
                  <div key={absence.id} className="flex items-center justify-between p-3 rounded-lg bg-white border">
                    <div>
                      <span className="font-medium">{absence.studentName}</span>
                      <span className="text-sm text-gray-600 ml-2">({absence.className})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm px-2 py-1 rounded-full bg-red-100 text-red-700">
                        {absence.reason}
                      </span>
                      <button className="text-xs text-blue-600 hover:underline">
                        보강 등록
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  오늘 결석자가 없습니다 🎉
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 내 반 보강 현황 */}
        <Card className="border-orange-200">
          <CardHeader className="pb-3 bg-orange-50">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              내 반 보강 일정
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {myMakeups.length > 0 ? (
                myMakeups.map((makeup) => (
                  <div key={makeup.id} className="flex items-center justify-between p-3 rounded-lg bg-white border">
                    <div>
                      <span className="font-medium">{makeup.studentName}</span>
                      <p className="text-xs text-gray-500">결석일: {makeup.originalDate}</p>
                    </div>
                    <div className="text-right">
                      {makeup.status === '오늘 예정' ? (
                        <>
                          <span className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                            오늘 {makeup.scheduledTime}
                          </span>
                          <button className="block mt-1 text-xs text-blue-600 hover:underline">
                            완료 처리
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                            {makeup.status}
                          </span>
                          <button className="block mt-1 text-xs text-blue-600 hover:underline">
                            일정 잡기
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  대기중인 보강이 없습니다 ✨
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 오늘의 수업 일정 */}
      <Card>
        <CardHeader>
          <CardTitle>오늘의 수업 일정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todaySchedule.length > 0 ? (
              todaySchedule.map((schedule) => (
                <div 
                  key={schedule.id} 
                  className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 ${schedule.isMakeup ? 'bg-orange-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600">{schedule.time}</span>
                    <span className="font-medium">{schedule.studentName}</span>
                    {schedule.isMakeup ? (
                      <span className="text-sm px-2 py-0.5 bg-orange-200 text-orange-800 rounded">보강</span>
                    ) : (
                      <span className="text-sm text-gray-600">{schedule.className}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {schedule.isMakeup ? (
                      <button className="text-sm text-green-600 hover:underline">완료 처리</button>
                    ) : (
                      <>
                        <button className="text-sm text-blue-600 hover:underline">피드 작성</button>
                        <span className="text-sm text-gray-400">|</span>
                        <button className="text-sm text-red-600 hover:underline">결석 처리</button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                오늘 수업 일정이 없습니다
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}