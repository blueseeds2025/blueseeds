'use server';

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// 타입 정의
// ============================================================================

export interface Student {
  id: string;
  name: string;
  displayCode: string;
  assignmentId: string;  // enrollment_schedule_assignments.id
  groupKey: string | null;
}

export interface ScheduleBlock {
  id: string;              // class_schedules.id
  classId: string;
  className: string;
  classColor: string | null;
  dayOfWeek: number;       // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  startTime: string;       // "14:00"
  endTime: string;         // "15:30"
  teacherId: string;
  teacherName: string;
  teacherColor: string;
  students: Student[];
}

export interface Teacher {
  id: string;
  name: string;
  color: string;
}

// ============================================================================
// 시간표 조회 (enrollment_schedule_assignments 기반)
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
    
    console.log('📋 profile:', profile);  // 디버그
    
    if (!profile) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    const isOwner = profile.role === 'owner';
    
    // 1. 스케줄 블록 조회
    let scheduleQuery = supabase
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
    let myClassIds: string[] = [];
    if (!isOwner) {
      const { data: myClassTeachers } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      myClassIds = (myClassTeachers || []).map(ct => ct.class_id);
      
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
      
      scheduleQuery = scheduleQuery.in('class_id', myClassIds);
    }
    
    const { data: schedules, error: schedulesError } = await scheduleQuery;
    
    console.log('📅 schedules:', schedules);  // 디버그
    console.log('❌ schedulesError:', schedulesError);  // 디버그
    
    if (schedulesError) throw schedulesError;
    
    // 2. 각 반의 담당 선생님 조회
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
    
    // 3. 각 스케줄의 학생 목록 조회 (enrollment_schedule_assignments 기반)
    const scheduleIds = (schedules || []).map(s => s.id);
    const scheduleStudentsMap: Record<string, Student[]> = {};
    
    if (scheduleIds.length > 0) {
      const { data: assignments } = await supabase
        .from('enrollment_schedule_assignments')
        .select(`
          id,
          class_schedule_id,
          group_key,
          students (
            id,
            name,
            display_code
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('class_schedule_id', scheduleIds)
        .is('end_date', null)
        .is('deleted_at', null);
      
      for (const a of assignments || []) {
        if (a.class_schedule_id && a.students) {
          const student = a.students as { id: string; name: string; display_code: string | null };
          
          if (!scheduleStudentsMap[a.class_schedule_id]) {
            scheduleStudentsMap[a.class_schedule_id] = [];
          }
          scheduleStudentsMap[a.class_schedule_id].push({
            id: student.id,
            name: student.name,
            displayCode: student.display_code || '',
            assignmentId: a.id,
            groupKey: a.group_key,
          });
        }
      }
    }
    
    // 4. 블록 데이터 가공
    console.log('🔢 schedules count:', (schedules || []).length);  // 디버그
    console.log('🔢 schedules with classes:', (schedules || []).filter(s => s.classes).length);  // 디버그
    
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
          id: s.id,  // schedule_id
          classId: cls.id,
          className: cls.name,
          classColor: cls.color,
          dayOfWeek: s.day_of_week,
          startTime: s.start_time?.slice(0, 5) || '00:00',
          endTime: s.end_time?.slice(0, 5) || '00:00',
          teacherId: teacherInfo.id,
          teacherName: teacherInfo.name,
          teacherColor: teacherInfo.color,
          students: scheduleStudentsMap[s.id] || [],
        };
      });
    
    // 5. 선생님 목록
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
// 학생 드래그 이동 - 이 요일만
// ============================================================================

export async function moveStudentThisDay(
  assignmentId: string,
  toScheduleId: string
): Promise<{
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
    
    // 1. 기존 배정 확인
    const { data: currentAssignment } = await supabase
      .from('enrollment_schedule_assignments')
      .select('id, student_id, class_schedule_id, group_key, tenant_id')
      .eq('id', assignmentId)
      .eq('tenant_id', profile.tenant_id)
      .is('end_date', null)
      .is('deleted_at', null)
      .single();
    
    if (!currentAssignment) {
      return { success: false, error: '배정 정보를 찾을 수 없습니다' };
    }
    
    // 2. 대상 스케줄 확인
    const { data: toSchedule } = await supabase
      .from('class_schedules')
      .select('id, class_id, tenant_id')
      .eq('id', toScheduleId)
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();
    
    if (!toSchedule) {
      return { success: false, error: '대상 스케줄을 찾을 수 없습니다' };
    }
    
    // 3. 권한 확인 (선생님은 자기 반끼리만)
    if (profile.role !== 'owner') {
      const { data: myClasses } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      const myClassIds = (myClasses || []).map(c => c.class_id);
      
      if (!myClassIds.includes(toSchedule.class_id)) {
        return { success: false, error: '권한이 없습니다. 자신의 담당 반으로만 이동 가능합니다.' };
      }
    }
    
    // 4. 기존 배정 종료
    const today = new Date().toISOString().split('T')[0];
    
    const { error: endError } = await supabase
      .from('enrollment_schedule_assignments')
      .update({
        end_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);
    
    if (endError) throw endError;
    
    // 5. 새 배정 생성 (group_key 유지)
    const { error: insertError } = await supabase
      .from('enrollment_schedule_assignments')
      .insert({
        tenant_id: profile.tenant_id,
        student_id: currentAssignment.student_id,
        class_schedule_id: toScheduleId,
        group_key: currentAssignment.group_key,
        start_date: today,
        created_by: user.id,
      });
    
    if (insertError) {
      if (insertError.code === '23505') {
        return { success: false, error: '이미 해당 시간에 배정된 학생입니다' };
      }
      throw insertError;
    }
    
    return { success: true };
  } catch (error) {
    console.error('moveStudentThisDay error:', error);
    return { success: false, error: '학생 이동에 실패했습니다' };
  }
}

// ============================================================================
// 학생 드래그 이동 - 그룹 전체 (같은 group_key)
// ============================================================================

export async function moveStudentWholeGroup(
  assignmentId: string,
  toScheduleId: string
): Promise<{
  success: boolean;
  movedDays?: number[];
  skippedDays?: number[];
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
    
    // 1. 기존 배정 확인
    const { data: currentAssignment } = await supabase
      .from('enrollment_schedule_assignments')
      .select(`
        id, 
        student_id, 
        class_schedule_id, 
        group_key,
        class_schedules (
          class_id,
          day_of_week,
          start_time,
          end_time
        )
      `)
      .eq('id', assignmentId)
      .eq('tenant_id', profile.tenant_id)
      .is('end_date', null)
      .is('deleted_at', null)
      .single();
    
    if (!currentAssignment) {
      return { success: false, error: '배정 정보를 찾을 수 없습니다' };
    }
    
    if (!currentAssignment.group_key) {
      return { success: false, error: '그룹 정보가 없어 전체 변경이 불가능합니다' };
    }
    
    // 2. 대상 스케줄 확인
    const { data: toSchedule } = await supabase
      .from('class_schedules')
      .select('id, class_id, day_of_week, start_time, end_time')
      .eq('id', toScheduleId)
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();
    
    if (!toSchedule) {
      return { success: false, error: '대상 스케줄을 찾을 수 없습니다' };
    }
    
    // 3. 같은 group_key의 모든 활성 배정 조회
    const { data: groupAssignments } = await supabase
      .from('enrollment_schedule_assignments')
      .select(`
        id,
        class_schedule_id,
        class_schedules (
          day_of_week,
          start_time,
          end_time
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', currentAssignment.student_id)
      .eq('group_key', currentAssignment.group_key)
      .is('end_date', null)
      .is('deleted_at', null);
    
    if (!groupAssignments || groupAssignments.length === 0) {
      return { success: false, error: '그룹 배정을 찾을 수 없습니다' };
    }
    
    // 4. 대상 반의 모든 스케줄 조회 (같은 시간대)
    const { data: targetClassSchedules } = await supabase
      .from('class_schedules')
      .select('id, day_of_week, start_time, end_time')
      .eq('tenant_id', profile.tenant_id)
      .eq('class_id', toSchedule.class_id)
      .eq('start_time', toSchedule.start_time)
      .eq('end_time', toSchedule.end_time)
      .eq('is_active', true)
      .is('deleted_at', null);
    
    // 요일별로 매핑
    const targetScheduleByDay: Record<number, string> = {};
    for (const ts of targetClassSchedules || []) {
      targetScheduleByDay[ts.day_of_week] = ts.id;
    }
    
    // 5. 매핑 계산
    const today = new Date().toISOString().split('T')[0];
    const movedDays: number[] = [];
    const skippedDays: number[] = [];
    
    for (const ga of groupAssignments) {
      const schedule = ga.class_schedules as { day_of_week: number; start_time: string; end_time: string };
      const dayOfWeek = schedule.day_of_week;
      
      if (targetScheduleByDay[dayOfWeek]) {
        // 이동 가능
        movedDays.push(dayOfWeek);
        
        // 기존 종료
        await supabase
          .from('enrollment_schedule_assignments')
          .update({
            end_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ga.id);
        
        // 새 배정
        await supabase
          .from('enrollment_schedule_assignments')
          .insert({
            tenant_id: profile.tenant_id,
            student_id: currentAssignment.student_id,
            class_schedule_id: targetScheduleByDay[dayOfWeek],
            group_key: currentAssignment.group_key,
            start_date: today,
            created_by: user.id,
          });
      } else {
        // 대상 슬롯 없음
        skippedDays.push(dayOfWeek);
      }
    }
    
    return { 
      success: true, 
      movedDays,
      skippedDays,
    };
  } catch (error) {
    console.error('moveStudentWholeGroup error:', error);
    return { success: false, error: '학생 이동에 실패했습니다' };
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
// 반 목록 조회 (스케줄 추가용)
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
    
    const { data: classesData, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
    if (error) throw error;
    
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