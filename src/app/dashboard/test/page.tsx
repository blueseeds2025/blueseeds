'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Database } from '@/lib/database.types';

export default function TestPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 사용자 정보
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setUserInfo({
          email: user.email,
          role: profile?.role,
          name: profile?.display_name
        });
      }

      // 학생 목록
      const { data: studentData, error } = await supabase
        .from('students')
        .select('*')
        .order('name');

      if (error) {
        console.log('Error loading students:', error.message);
      } else {
        console.log('Students loaded:', studentData?.length || 0);
        setStudents(studentData || []);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
    
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">RLS 테스트</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>로그인 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <p>이메일: {userInfo?.email}</p>
          <p>역할: {userInfo?.role}</p>
          <p>이름: {userInfo?.name}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>학생 목록 ({students.length}명)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>로딩 중...</p>
          ) : students.length > 0 ? (
            <div className="space-y-2">
              {students.map((student) => (
                <div key={student.id} className="p-3 bg-gray-50 rounded">
                  <p>{student.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>학생이 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}