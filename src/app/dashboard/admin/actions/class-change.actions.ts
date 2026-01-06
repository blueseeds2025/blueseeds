'use server';

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// 시간 변경 요청 목록 조회 (원장용)
// ============================================================================

export async function getClassChangeRequests(): Promise<{
  success: boolean;
  data?: {
    id: string;
    studentName: string;
    studentId: string;
    currentClass: string;
    message: string;
    requestedBy: string;
    createdAt: string;
  }[];
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
    
    const { data: requests, error } = await supabase
      .from('class_change_requests')
      .select(`
        id,
        message,
        created_at,
        students (
          id,
          name
        ),
        profiles:requested_by (
          display_name
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 학생들의 현재 반 정보 조회
    const studentIds = (requests || []).map(r => (r.students as any)?.id).filter(Boolean);
    
    let studentClassMap: Record<string, string> = {};
    
    if (studentIds.length > 0) {
      const { data: assignments } = await supabase
        .from('enrollment_schedule_assignments')
        .select(`
          student_id,
          class_schedules (
            classes (
              name
            )
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .in('student_id', studentIds)
        .is('end_date', null)
        .is('deleted_at', null);
      
      for (const a of assignments || []) {
        if (a.student_id && !studentClassMap[a.student_id]) {
          const className = (a.class_schedules as any)?.classes?.name;
          if (className) {
            studentClassMap[a.student_id] = className;
          }
        }
      }
    }
    
    const result = (requests || []).map(r => {
      const student = r.students as any;
      const requester = r.profiles as any;
      
      return {
        id: r.id,
        studentId: student?.id || '',
        studentName: student?.name || '알 수 없음',
        currentClass: studentClassMap[student?.id] || '미배정',
        message: r.message,
        requestedBy: requester?.display_name || '알 수 없음',
        createdAt: r.created_at,
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('getClassChangeRequests error:', error);
    return { success: false, error: '요청 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 요청 처리 완료
// ============================================================================

export async function completeClassChangeRequest(requestId: string): Promise<{
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
      .from('class_change_requests')
      .update({
        status: 'done',
        done_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('tenant_id', profile.tenant_id);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('completeClassChangeRequest error:', error);
    return { success: false, error: '처리에 실패했습니다' };
  }
}
