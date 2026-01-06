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

    // ============================================================================
    // Plan B: enrollment_schedule_assignments 기준으로 학생 조회
    // ============================================================================

    // 1. 해당 반들의 스케줄 조회
    const { data: schedules, error: schedulesError } = await supabase
      .from('class_schedules')
      .select('id, class_id')
      .eq('tenant_id', profile.tenant_id)
      .in('class_id', filteredClassIds)
      .eq('is_active', true)
      .is('deleted_at', null);

    if (schedulesError) {
      console.error('Schedules query error:', schedulesError);
      return NextResponse.json({ success: false, error: schedulesError.message }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, students: [] });
    }

    const scheduleIds = schedules.map(s => s.id);
    
    // schedule_id → class_id 매핑
    const scheduleToClassMap: Record<string, string> = {};
    for (const s of schedules) {
      scheduleToClassMap[s.id] = s.class_id;
    }

    // 2. 해당 스케줄들에 배정된 학생 조회
    const { data: assignments, error: assignmentsError } = await supabase
      .from('enrollment_schedule_assignments')
      .select(`
        student_id,
        class_schedule_id,
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
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .in('class_schedule_id', scheduleIds)
      .is('end_date', null)
      .is('deleted_at', null);

    if (assignmentsError) {
      console.error('Assignments query error:', assignmentsError);
      return NextResponse.json({ success: false, error: assignmentsError.message }, { status: 500 });
    }

    // 3. 반 정보 조회
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name, color')
      .in('id', filteredClassIds);

    if (classesError) {
      console.error('Classes query error:', classesError);
      return NextResponse.json({ success: false, error: classesError.message }, { status: 500 });
    }

    const classMap: Record<string, { name: string; color: string | null }> = {};
    for (const c of classes || []) {
      classMap[c.id] = { name: c.name, color: c.color };
    }

    // 4. 학생 데이터 변환 (중복 제거: 같은 학생이 여러 스케줄에 있을 수 있음)
    const studentMap: Record<string, {
      id: string;
      name: string;
      phone: string | null;
      parent_phone: string | null;
      student_phone: string | null;
      school: string | null;
      grade: string | null;
      address: string | null;
      memo: string | null;
      is_active: boolean;
      class_id: string;
      class_name: string;
      class_color: string | null;
    }> = {};

    for (const assignment of assignments || []) {
      const student = assignment.students as {
        id: string;
        name: string;
        phone: string | null;
        parent_phone: string | null;
        student_phone: string | null;
        address: string | null;
        school: string | null;
        grade: string | null;
        memo: string | null;
        is_active: boolean;
      } | null;

      if (!student || !assignment.class_schedule_id) continue;

      const classId = scheduleToClassMap[assignment.class_schedule_id];
      if (!classId) continue;

      const classInfo = classMap[classId];
      if (!classInfo) continue;

      // 이미 있는 학생이면 스킵 (첫 번째 반 기준)
      if (studentMap[student.id]) continue;

      studentMap[student.id] = {
        id: student.id,
        name: student.name,
        phone: student.phone,
        parent_phone: student.parent_phone,
        student_phone: student.student_phone,
        school: student.school,
        grade: student.grade,
        address: student.address,
        memo: student.memo,
        is_active: student.is_active,
        class_id: classId,
        class_name: classInfo.name,
        class_color: classInfo.color,
      };
    }

    // 5. 이름순 정렬
    const students = Object.values(studentMap)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    return NextResponse.json({ success: true, students });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}