import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인 필요' }, { status: 401 });
    }
    
    // 프로필 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ success: false, error: '프로필 없음' }, { status: 403 });
    }

    const body = await request.json();
    const { classId } = body;

    // 담당 반 ID 목록 조회
    let allowedClassIds: string[] = [];
    
    if (profile.role === 'owner') {
      // 원장은 모든 반
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null);
      
      allowedClassIds = (allClasses || []).map(c => c.id);
    } else {
      // 교사는 담당 반만
      const { data: teacherClasses } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      allowedClassIds = (teacherClasses || []).map(tc => tc.class_id);
    }

    if (allowedClassIds.length === 0) {
      return NextResponse.json({ success: true, students: [] });
    }

    // 특정 반 선택 시 권한 체크
    const targetClassIds = classId ? [classId] : allowedClassIds;
    const filteredClassIds = targetClassIds.filter(id => allowedClassIds.includes(id));

    if (filteredClassIds.length === 0) {
      return NextResponse.json({ success: true, students: [] });
    }

    // 반별 학생 조회 (class_members 통해)
    const { data: members, error: membersError } = await supabase
      .from('class_members')
      .select(`
        student_id,
        class_id,
        is_active,
        students (
          id,
          name,
          phone,
          parent_phone,
          student_phone,
          address,
          school,
          grade,
          memo,
          is_active
        ),
        classes (
          id,
          name,
          color
        )
      `)
      .in('class_id', filteredClassIds)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (membersError) {
      console.error('Members query error:', membersError);
      return NextResponse.json({ success: false, error: membersError.message }, { status: 500 });
    }

    // 데이터 변환
    const students = (members || [])
      .filter((m: any) => m.students && m.classes)
      .map((m: any) => ({
        id: m.students.id,
        name: m.students.name,
        phone: m.students.phone,
        parent_phone: m.students.parent_phone,
        student_phone: m.students.student_phone,
        school: m.students.school,
        grade: m.students.grade,
        address: m.students.address,
        memo: m.students.memo,
        is_active: m.students.is_active,
        class_id: m.classes.id,
        class_name: m.classes.name,
        class_color: m.classes.color,
      }))
      // 이름순 정렬
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ko'));

    return NextResponse.json({ success: true, students });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
