'use server';

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// 타입 정의
// ============================================================================

export interface ScheduleBlock {
  id: string;
  classId: string;
  className: string;
  classColor: string | null;
  dayOfWeek: number;  // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  startTime: string;  // "14:00"
  endTime: string;    // "15:30"
  teacherId: string;
  teacherName: string;
  teacherColor: string;
  studentCount: number;
}

export interface Teacher {
  id: string;
  name: string;
  color: string;
}

// ============================================================================
// 시간표 조회 (원장: 전체 / 선생님: 자기 반만)
// ============================================================================

export async function getScheduleBlocks(): Promise<{
  success: boolean;
  data?: {
    blocks: ScheduleBlock[];
    teachers: Teacher[];
    userRole: 'owner' | 'teacher';
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role, display_name, calendar_color')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    const isOwner = profile.role === 'owner';
    
    // 1. 스케줄 블록 조회
    let query = supabase
      .from('class_schedules')
      .select(`
        id,
        class_id,
        day_of_week,
        start_time,
        end_time,
        classes (
          id,
          name,
          color
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('day_of_week')
      .order('start_time');
    
    // 선생님은 자기 반만 (class_teachers 기반)
    if (!isOwner) {
      const { data: myClassTeachers } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      const myClassIds = (myClassTeachers || []).map(ct => ct.class_id);
      
      if (myClassIds.length === 0) {
        return { 
          success: true, 
          data: { 
            blocks: [], 
            teachers: [{
              id: user.id,
              name: profile.display_name || '나',
              color: profile.calendar_color || '#6366F1'
            }],
            userRole: 'teacher' 
          } 
        };
      }
      
      query = query.in('class_id', myClassIds);
    }
    
    const { data: schedules, error: schedulesError } = await query;
    
    if (schedulesError) throw schedulesError;
    
    // 2. 각 반의 담당 선생님 조회 (class_teachers 기반)
    const classIds = [...new Set((schedules || []).map(s => s.class_id))];
    
    const classTeacherMap: Record<string, { id: string; name: string; color: string }> = {};
    
    if (classIds.length > 0) {
      const { data: classTeachers } = await supabase
        .from('class_teachers')
        .select(`
          class_id,
          teacher_id,
          profiles:teacher_id (
            id,
            display_name,
            calendar_color
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('class_id', classIds)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      // 반별 첫 번째 선생님 (담임)
      for (const ct of classTeachers || []) {
        if (ct.class_id && !classTeacherMap[ct.class_id]) {
          const teacher = ct.profiles as any;
          classTeacherMap[ct.class_id] = {
            id: ct.teacher_id || '',
            name: teacher?.display_name || '미지정',
            color: teacher?.calendar_color || '#6366F1',
          };
        }
      }
    }
    
    // 3. 각 반의 학생 수 조회
    const studentCounts: Record<string, number> = {};
    
    if (classIds.length > 0) {
      const { data: enrollmentCounts } = await supabase
        .from('enrollments')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .in('class_id', classIds)
        .is('end_date', null)
        .is('deleted_at', null);
      
      // 반별로 카운트
      for (const e of enrollmentCounts || []) {
        if (e.class_id) {
          studentCounts[e.class_id] = (studentCounts[e.class_id] || 0) + 1;
        }
      }
    }
    
    // 4. 블록 데이터 가공
    const blocks: ScheduleBlock[] = (schedules || [])
      .filter(s => s.classes)
      .map(s => {
        const cls = s.classes as any;
        const teacherInfo = classTeacherMap[cls.id] || { 
          id: '', 
          name: '미지정', 
          color: '#6366F1' 
        };
        
        return {
          id: s.id,
          classId: cls.id,
          className: cls.name,
          classColor: cls.color,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time?.slice(0, 5) || '00:00',
          endTime: s.end_time?.slice(0, 5) || '00:00',
          teacherId: teacherInfo.id,
          teacherName: teacherInfo.name,
          teacherColor: teacherInfo.color,
          studentCount: studentCounts[cls.id] || 0,
        };
      });
    
    // 5. 선생님 목록 (원장용 Legend)
    const teacherMap = new Map<string, Teacher>();
    
    for (const block of blocks) {
      if (block.teacherId && !teacherMap.has(block.teacherId)) {
        teacherMap.set(block.teacherId, {
          id: block.teacherId,
          name: block.teacherName,
          color: block.teacherColor,
        });
      }
    }
    
    // "미지정" 그룹도 추가
    const hasUnassigned = blocks.some(b => !b.teacherId);
    if (hasUnassigned) {
      teacherMap.set('', {
        id: '',
        name: '미지정',
        color: '#9CA3AF',
      });
    }
    
    const teachers = Array.from(teacherMap.values());
    
    return {
      success: true,
      data: {
        blocks,
        teachers,
        userRole: isOwner ? 'owner' : 'teacher',
      },
    };
  } catch (error) {
    console.error('getScheduleBlocks error:', error);
    return { success: false, error: '시간표를 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 블록 클릭 시 학생 명단 조회
// ============================================================================

export async function getClassStudentsForBlock(classId: string): Promise<{
  success: boolean;
  data?: {
    className: string;
    students: { id: string; name: string; displayCode: string }[];
  };
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 반 정보
    const { data: classInfo } = await supabase
      .from('classes')
      .select('name')
      .eq('id', classId)
      .eq('tenant_id', profile.tenant_id)
      .single();
    
    // 학생 목록 (enrollments 기반)
    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        students (
          id,
          name,
          display_code
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', classId)
      .is('end_date', null)
      .is('deleted_at', null);
    
    if (error) throw error;
    
    const students = (enrollments || [])
      .filter(e => e.students)
      .map(e => {
        const s = e.students as { id: string; name: string; display_code: string | null };
        return {
          id: s.id,
          name: s.name,
          displayCode: s.display_code || '',
        };
      });
    
    return {
      success: true,
      data: {
        className: classInfo?.name || '알 수 없음',
        students,
      },
    };
  } catch (error) {
    console.error('getClassStudentsForBlock error:', error);
    return { success: false, error: '학생 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 스케줄 추가 (관리자용)
// ============================================================================

export async function createSchedule(input: {
  classId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 원장만 가능
    if (profile.role !== 'owner') {
      return { success: false, error: '권한이 없습니다' };
    }
    
    const { error } = await supabase
      .from('class_schedules')
      .insert({
        tenant_id: profile.tenant_id,
        class_id: input.classId,
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
        is_active: true,
      });
    
    if (error) {
      if (error.code === '23505') {
        return { success: false, error: '같은 시간에 이미 스케줄이 있습니다' };
      }
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('createSchedule error:', error);
    return { success: false, error: '스케줄 추가에 실패했습니다' };
  }
}

// ============================================================================
// 스케줄 삭제 (관리자용)
// ============================================================================

export async function deleteSchedule(scheduleId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 원장만 가능
    if (profile.role !== 'owner') {
      return { success: false, error: '권한이 없습니다' };
    }
    
    const { error } = await supabase
      .from('class_schedules')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .eq('id', scheduleId)
      .eq('tenant_id', profile.tenant_id);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('deleteSchedule error:', error);
    return { success: false, error: '스케줄 삭제에 실패했습니다' };
  }
}

// ============================================================================
// 반 목록 조회 (스케줄 추가용) - class_teachers 기반
// ============================================================================

export async function getClassesForSchedule(): Promise<{
  success: boolean;
  data?: { id: string; name: string; teacherName: string }[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    // 반 목록 조회
    const { data: classesData, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
    if (error) throw error;
    
    // 각 반의 담당 선생님 조회
    const classIds = (classesData || []).map(c => c.id);
    
    const classTeacherMap: Record<string, string> = {};
    
    if (classIds.length > 0) {
      const { data: classTeachers } = await supabase
        .from('class_teachers')
        .select(`
          class_id,
          profiles:teacher_id (
            display_name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('class_id', classIds)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      for (const ct of classTeachers || []) {
        if (ct.class_id && !classTeacherMap[ct.class_id]) {
          const teacher = ct.profiles as any;
          classTeacherMap[ct.class_id] = teacher?.display_name || '미지정';
        }
      }
    }
    
    const classes = (classesData || []).map(c => ({
      id: c.id,
      name: c.name,
      teacherName: classTeacherMap[c.id] || '미지정',
    }));
    
    return { success: true, data: classes };
  } catch (error) {
    console.error('getClassesForSchedule error:', error);
    return { success: false, error: '반 목록을 불러오는데 실패했습니다' };
  }
}
