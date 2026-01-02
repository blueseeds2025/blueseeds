// ============================================================================
// 월간 리포트 Server Actions
// ============================================================================
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/actions';
import type {
  MonthlyReport,
  MonthlyReportWithStudent,
  MonthlyReportFilter,
  MonthlyReportListResult,
  CreateMonthlyReportInput,
  UpdateMonthlyReportInput,
  ReportStatus,
  AttendanceSummary,
  ScoreSummary,
  ProgressItem,
  TemplateType,
} from '@/types/monthly-report.types';

// ----------------------------------------------------------------------------
// 헬퍼: 현재 사용자 프로필 가져오기
// ----------------------------------------------------------------------------
async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: '로그인이 필요합니다.' };
  }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', user.id)
    .single();
  
  if (error || !profile) {
    return { error: '프로필을 찾을 수 없습니다.' };
  }
  
  return { profile, supabase };
}

// ----------------------------------------------------------------------------
// 0. 학원 설정에서 월간 템플릿 가져오기
// ----------------------------------------------------------------------------
export async function getMonthlyTemplateFromSettings(): Promise<ActionResult<{ templateType: TemplateType }>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const { data: settings, error } = await supabase
      .from('report_settings')
      .select('monthly_template_type')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .single();
    
    if (error || !settings) {
      return { ok: true, data: { templateType: 1 as TemplateType } };
    }
    
    return { 
      ok: true, 
      data: { templateType: (settings.monthly_template_type || 1) as TemplateType } 
    };
  } catch (err) {
    console.error('getMonthlyTemplateFromSettings exception:', err);
    return { ok: false, message: '설정을 불러오는데 실패했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 1. 리포트 목록 조회
// ----------------------------------------------------------------------------
export async function getMonthlyReports(
  filter: MonthlyReportFilter = {}
): Promise<ActionResult<MonthlyReportListResult>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    let query = supabase
      .from('monthly_reports')
      .select(`
        *,
        student:students!inner(id, name),
        creator:profiles!monthly_reports_created_by_fkey(id, name)
      `)
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('report_year', { ascending: false })
      .order('report_month', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (filter.year) {
      query = query.eq('report_year', filter.year);
    }
    if (filter.month) {
      query = query.eq('report_month', filter.month);
    }
    if (filter.student_id) {
      query = query.eq('student_id', filter.student_id);
    }
    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('getMonthlyReports error:', error);
      return { ok: false, message: '리포트 목록을 불러오는데 실패했습니다.' };
    }
    
    return {
      ok: true,
      data: {
        reports: (data || []) as unknown as MonthlyReportWithStudent[],
        total: data?.length || 0,
      },
    };
  } catch (err) {
    console.error('getMonthlyReports exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 2. 단일 리포트 조회
// ----------------------------------------------------------------------------
export async function getMonthlyReport(
  reportId: string
): Promise<ActionResult<MonthlyReportWithStudent>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const { data, error } = await supabase
      .from('monthly_reports')
      .select(`
        *,
        student:students!inner(id, name),
        creator:profiles!monthly_reports_created_by_fkey(id, name)
      `)
      .eq('id', reportId)
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .single();
    
    if (error) {
      console.error('getMonthlyReport error:', error);
      return { ok: false, message: '리포트를 찾을 수 없습니다.' };
    }
    
    return { ok: true, data: data as unknown as MonthlyReportWithStudent };
  } catch (err) {
    console.error('getMonthlyReport exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 3. 리포트 생성 (데이터 집계 포함)
// ----------------------------------------------------------------------------
export async function createMonthlyReport(
  input: CreateMonthlyReportInput
): Promise<ActionResult<MonthlyReport>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  if (!input.student_id) {
    return { ok: false, message: '학생을 선택해주세요.' };
  }
  if (!input.report_year || !input.report_month) {
    return { ok: false, message: '리포트 기간을 선택해주세요.' };
  }
  if (input.report_month < 1 || input.report_month > 12) {
    return { ok: false, message: '올바른 월을 선택해주세요.' };
  }
  
  try {
    const { data: existing } = await supabase
      .from('monthly_reports')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', input.student_id)
      .eq('report_year', input.report_year)
      .eq('report_month', input.report_month)
      .is('deleted_at', null)
      .single();
    
    if (existing) {
      return { ok: false, message: '해당 월의 리포트가 이미 존재합니다.' };
    }
    
    let templateType = input.template_type;
    if (!templateType) {
      const templateResult = await getMonthlyTemplateFromSettings();
      templateType = templateResult.ok && templateResult.data 
        ? templateResult.data.templateType 
        : 1;
    }
    
    const aggregateResult = await aggregateFeedData(
      supabase,
      profile.tenant_id,
      input.student_id,
      input.report_year,
      input.report_month
    );
    
    if (!aggregateResult.ok) {
      return { ok: false, message: aggregateResult.message };
    }
    
    const { data, error } = await supabase
      .from('monthly_reports')
      .insert({
        tenant_id: profile.tenant_id,
        student_id: input.student_id,
        report_year: input.report_year,
        report_month: input.report_month,
        template_type: templateType,
        attendance_summary: aggregateResult.data?.attendance || {},
        score_summary: aggregateResult.data?.scores || {},
        progress_summary: aggregateResult.data?.progress || [],
        status: 'draft',
        created_by: profile.id,
      })
      .select()
      .single();
    
    if (error) {
      console.error('createMonthlyReport error:', error);
      return { ok: false, message: '리포트 생성에 실패했습니다.' };
    }
    
    revalidatePath('/dashboard/admin/reports/monthly');
    return { ok: true, data: data as unknown as MonthlyReport };
  } catch (err) {
    console.error('createMonthlyReport exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 4. 리포트 수정
// ----------------------------------------------------------------------------
export async function updateMonthlyReport(
  reportId: string,
  input: UpdateMonthlyReportInput
): Promise<ActionResult<MonthlyReport>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const { data, error } = await supabase
      .from('monthly_reports')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();
    
    if (error) {
      console.error('updateMonthlyReport error:', error);
      return { ok: false, message: '리포트 수정에 실패했습니다.' };
    }
    
    revalidatePath('/dashboard/admin/reports/monthly');
    revalidatePath(`/dashboard/admin/reports/monthly/${reportId}`);
    return { ok: true, data: data as unknown as MonthlyReport };
  } catch (err) {
    console.error('updateMonthlyReport exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 5. 리포트 삭제 (soft delete)
// ----------------------------------------------------------------------------
export async function deleteMonthlyReport(
  reportId: string
): Promise<ActionResult<void>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const { error } = await supabase
      .from('monthly_reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', reportId)
      .eq('tenant_id', profile.tenant_id);
    
    if (error) {
      console.error('deleteMonthlyReport error:', error);
      return { ok: false, message: '리포트 삭제에 실패했습니다.' };
    }
    
    revalidatePath('/dashboard/admin/reports/monthly');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('deleteMonthlyReport exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 6. 리포트 상태 변경
// ----------------------------------------------------------------------------
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  sendMethod?: 'kakao' | 'pdf' | 'print'
): Promise<ActionResult<MonthlyReport>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
      if (sendMethod) {
        updateData.sent_method = sendMethod;
      }
    }
    
    const { data, error } = await supabase
      .from('monthly_reports')
      .update(updateData)
      .eq('id', reportId)
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .select()
      .single();
    
    if (error) {
      console.error('updateReportStatus error:', error);
      return { ok: false, message: '상태 변경에 실패했습니다.' };
    }
    
    revalidatePath('/dashboard/admin/reports/monthly');
    revalidatePath(`/dashboard/admin/reports/monthly/${reportId}`);
    return { ok: true, data: data as unknown as MonthlyReport };
  } catch (err) {
    console.error('updateReportStatus exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 7. 피드 데이터 집계 (내부 함수)
// ----------------------------------------------------------------------------
async function aggregateFeedData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  studentId: string,
  year: number,
  month: number
): Promise<ActionResult<{
  attendance: AttendanceSummary;
  scores: ScoreSummary;
  progress: ProgressItem[];
}>> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    
    const { data: feeds, error: feedsError } = await supabase
      .from('student_feeds')
      .select('id, feed_date, attendance_status, progress_text')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .gte('feed_date', startDate)
      .lte('feed_date', endDate);
    
    if (feedsError) {
      console.error('aggregateFeedData feeds error:', feedsError);
      return { ok: false, message: '피드 조회 실패' };
    }
    
    const attendance: AttendanceSummary = {
      total_days: feeds?.length || 0,
      attended: 0,
      late: 0,
      absent: 0,
      rate: 0,
    };
    
    feeds?.forEach((feed) => {
      switch (feed.attendance_status) {
        case 'present':
          attendance.attended++;
          break;
        case 'late':
          attendance.late++;
          break;
        case 'absent':
          attendance.absent++;
          break;
      }
    });
    
    attendance.rate = attendance.total_days > 0
      ? Math.round((attendance.attended / attendance.total_days) * 100)
      : 0;
    
    const feedIds = feeds?.map((f) => f.id) || [];
    const scores: ScoreSummary = {};
    
    if (feedIds.length > 0) {
      const { data: values, error: valuesError } = await supabase
        .from('feed_values')
        .select(`
          score,
          set:feed_option_sets!inner(
            id,
            name,
            is_scored,
            is_in_weekly_stats,
            stats_category
          )
        `)
        .in('feed_id', feedIds)
        .not('score', 'is', null);
      
      if (valuesError) {
        console.error('aggregateFeedData values error:', valuesError);
      } else if (values) {
        const scoreMap: Record<string, { sum: number; count: number }> = {};
        
        values.forEach((v) => {
          const set = v.set as {
            name: string;
            is_scored: boolean;
            is_in_weekly_stats: boolean;
            stats_category: string | null;
          };
          
          if (!set.is_in_weekly_stats) return;
          if (!set.is_scored || v.score === null) return;
          
          const category = set.stats_category || set.name;
          if (!scoreMap[category]) {
            scoreMap[category] = { sum: 0, count: 0 };
          }
          scoreMap[category].sum += v.score;
          scoreMap[category].count++;
        });
        
        Object.entries(scoreMap).forEach(([category, { sum, count }]) => {
          scores[category] = {
            average: Math.round(sum / count),
            count,
          };
        });
      }
    }
    
    const progress: ProgressItem[] = [];
    const weekMap: Record<number, string[]> = {};
    
    feeds?.forEach((feed) => {
      if (!feed.progress_text) return;
      const date = new Date(feed.feed_date);
      const week = Math.ceil(date.getDate() / 7);
      if (!weekMap[week]) {
        weekMap[week] = [];
      }
      weekMap[week].push(feed.progress_text);
    });
    
    Object.entries(weekMap).forEach(([week, contents]) => {
      progress.push({
        week: parseInt(week),
        content: contents.join(', '),
      });
    });
    
    return {
      ok: true,
      data: { attendance, scores, progress },
    };
  } catch (err) {
    console.error('aggregateFeedData exception:', err);
    return { ok: false, message: '데이터 집계 중 오류 발생' };
  }
}

// ----------------------------------------------------------------------------
// 8. 일괄 생성 (반 전체 학생)
// ----------------------------------------------------------------------------
export async function createMonthlyReportsForClass(
  classId: string,
  year: number,
  month: number,
  templateType: number = 1
): Promise<ActionResult<{ created: number; skipped: number; errors: string[] }>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const { data: members, error: membersError } = await supabase
      .from('class_members')
      .select('student_id')
      .eq('class_id', classId)
      .eq('is_active', true);
    
    if (membersError) {
      return { ok: false, message: '학생 목록 조회 실패' };
    }
    
    const studentIds = members?.map((m) => m.student_id) || [];
    
    if (studentIds.length === 0) {
      return { ok: false, message: '해당 반에 학생이 없습니다.' };
    }
    
    const { data: existing } = await supabase
      .from('monthly_reports')
      .select('student_id')
      .eq('tenant_id', profile.tenant_id)
      .eq('report_year', year)
      .eq('report_month', month)
      .in('student_id', studentIds)
      .is('deleted_at', null);
    
    const existingStudentIds = new Set(existing?.map((e) => e.student_id) || []);
    
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const studentId of studentIds) {
      if (existingStudentIds.has(studentId)) {
        skipped++;
        continue;
      }
      
      const createResult = await createMonthlyReport({
        student_id: studentId,
        report_year: year,
        report_month: month,
        template_type: templateType as TemplateType,
      });
      
      if (createResult.ok) {
        created++;
      } else {
        errors.push(`학생 ${studentId}: ${createResult.message}`);
      }
    }
    
    revalidatePath('/dashboard/admin/reports/monthly');
    return {
      ok: true,
      data: { created, skipped, errors },
    };
  } catch (err) {
    console.error('createMonthlyReportsForClass exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 9. 학생 목록 조회 (리포트 생성용)
// ----------------------------------------------------------------------------
export async function getStudentsForMonthlyReport(
  classId?: string
): Promise<ActionResult<{ id: string; name: string; class_name?: string }[]>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    if (classId) {
      const { data, error } = await supabase
        .from('class_members')
        .select(`
          student:students!inner(id, name),
          class:classes!inner(name)
        `)
        .eq('class_id', classId)
        .eq('is_active', true);
      
      if (error) {
        return { ok: false, message: '학생 목록 조회 실패' };
      }
      
      const students = data?.map((d) => ({
        id: (d.student as { id: string }).id,
        name: (d.student as { name: string }).name,
        class_name: (d.class as { name: string }).name,
      })) || [];
      
      return { ok: true, data: students };
    } else {
      const { data, error } = await supabase
        .from('students')
        .select('id, name')
        .eq('tenant_id', profile.tenant_id)
        .order('name');
      
      if (error) {
        return { ok: false, message: '학생 목록 조회 실패' };
      }
      
      return { ok: true, data: data || [] };
    }
  } catch (err) {
    console.error('getStudentsForMonthlyReport exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}

// ----------------------------------------------------------------------------
// 10. 반 목록 조회
// ----------------------------------------------------------------------------
export async function getClassesForMonthlyReport(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const result = await getCurrentProfile();
  if ('error' in result) {
    return { ok: false, message: result.error };
  }
  const { profile, supabase } = result;
  
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
    if (error) {
      return { ok: false, message: '반 목록 조회 실패' };
    }
    
    return { ok: true, data: data || [] };
  } catch (err) {
    console.error('getClassesForMonthlyReport exception:', err);
    return { ok: false, message: '서버 오류가 발생했습니다.' };
  }
}