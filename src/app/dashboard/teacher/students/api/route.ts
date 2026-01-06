import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // 디버그 정보 수집
  const debug: Record<string, unknown> = {};
  
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    debug.user_id = user?.id || 'NO_USER';
    
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인 필요', debug }, { status: 401 });
    }
    
    // 프로필 확인
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    debug.profile = profile;
    debug.profile_error = profileError?.message;
    
    if (!profile) {
      return NextResponse.json({ success: false, error: '프로필 없음', debug }, { status: 403 });
    }

    const body = await request.json();
    const { classId } = body;

    // 담당 반 ID 목록 조회
    let allowedClassIds: string[] = [];
    
    if (profile.role === 'owner') {
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .is('deleted_at', null);
      
      allowedClassIds = (allClasses || []).map(c => c.id);
    } else {
      const { data: teacherClasses, error: tcError } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      debug.teacher_classes_raw = teacherClasses;
      debug.teacher_classes_error = tcError?.message;
      
      allowedClassIds = (teacherClasses || []).map(tc => tc.class_id);
    }

    debug.step1_allowedClassIds = allowedClassIds;
    debug.step1_count = allowedClassIds.length;

    if (allowedClassIds.length === 0) {
      return NextResponse.json({ success: true, students: [], debug });
    }

    const targetClassIds = classId ? [classId] : allowedClassIds;
    const filteredClassIds = targetClassIds.filter(id => allowedClassIds.includes(id));

    debug.step1b_filteredClassIds = filteredClassIds;

    if (filteredClassIds.length === 0) {
      return NextResponse.json({ success: true, students: [], debug });
    }

    // 1. 해당 반들의 스케줄 조회
    const { data: schedules, error: schedulesError } = await supabase
      .from('class_schedules')
      .select('id, class_id')
      .eq('tenant_id', profile.tenant_id)
      .in('class_id', filteredClassIds)
      .eq('is_active', true)
      .is('deleted_at', null);

    debug.step2_schedules = schedules;
    debug.step2_count = schedules?.length || 0;
    debug.step2_error = schedulesError?.message;

    if (schedulesError) {
      return NextResponse.json({ success: false, error: schedulesError.message, debug }, { status: 500 });
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, students: [], debug });
    }

    const scheduleIds = schedules.map(s => s.id);
    debug.step2_scheduleIds = scheduleIds;

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

    debug.step3_assignments_count = assignments?.length || 0;
    debug.step3_error = assignmentsError?.message;

    if (assignmentsError) {
      return NextResponse.json({ success: false, error: assignmentsError.message, debug }, { status: 500 });
    }

    // 3. 반 정보 조회
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name, color')
      .in('id', filteredClassIds);

    debug.step4_classes = classes;

    const scheduleToClassMap: Record<string, string> = {};
    for (const s of schedules) {
      scheduleToClassMap[s.id] = s.class_id;
    }

    const classMap: Record<string, { name: string; color: string | null }> = {};
    for (const c of classes || []) {
      classMap[c.id] = { name: c.name, color: c.color };
    }

    // 4. 학생 데이터 변환
    const studentMap: Record<string, unknown> = {};

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

    debug.step5_studentMap_count = Object.keys(studentMap).length;

    const students = Object.values(studentMap)
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ko'));

    return NextResponse.json({ success: true, students, debug });
  } catch (error) {
    debug.catch_error = String(error);
    return NextResponse.json({ success: false, error: '서버 오류', debug }, { status: 500 });
  }
}
