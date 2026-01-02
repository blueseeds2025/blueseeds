'use server';

import { createClient } from '@/lib/supabase/server';
import type {
  WeeklyReportData,
  CategoryStat,
  ScoreCategoryStat,
  TextCategoryStat,
  StrengthWeaknessAnalysis,
  MessageTone,
  ReportSettings,
} from '@/types/report';
import { PRAISE_TEMPLATES } from '@/types/report';
import { DEFAULT_STRENGTH_THRESHOLD, DEFAULT_WEAKNESS_THRESHOLD } from '../constants';

// ============================================================================
// 타입 정의
// ============================================================================

type ActionResult<T> = 
  | { ok: true; data: T }
  | { ok: false; message: string };

interface StudentBasic {
  id: string;
  name: string;
  display_code: string | null;
}

// ============================================================================
// 헬퍼: 인증 및 테넌트 확인
// ============================================================================

async function getAuthContext() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: '로그인이 필요합니다' };
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    return { error: '프로필을 찾을 수 없습니다' };
  }
  
  return { supabase, user, profile };
}

// ============================================================================
// 테넌트 플랜 조회
// ============================================================================

export async function getTenantPlan(): Promise<ActionResult<{ plan: 'basic' | 'premium' }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, profile } = ctx;
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('plan')
      .eq('id', profile.tenant_id)
      .single();
    
    if (error) {
      return { ok: false, message: '플랜 정보를 불러오는데 실패했습니다' };
    }
    
    return {
      ok: true,
      data: { plan: (tenant?.plan as 'basic' | 'premium') || 'basic' },
    };
  } catch (error) {
    console.error('getTenantPlan error:', error);
    return { ok: false, message: '서버 오류가 발생했습니다' };
  }
}

// ============================================================================
// 리포트 설정 조회
// ============================================================================

export async function getReportSettings(): Promise<ActionResult<ReportSettings & { messageTone: MessageTone; weekly_template_type: number }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, profile } = ctx;
    
    // report_settings 조회 (weekly_template_type 추가!)
    const { data: settings } = await supabase
      .from('report_settings')
      .select('id, tenant_id, strength_threshold, weakness_threshold, weekly_template_type, created_at, updated_at, deleted_at')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .single();
    
    // tenant의 message_tone 조회
    const { data: tenant } = await supabase
      .from('tenants')
      .select('message_tone')
      .eq('id', profile.tenant_id)
      .single();
    
  const reportSettings: ReportSettings = {
  id: settings?.id ?? '',
  tenant_id: settings?.tenant_id ?? profile.tenant_id,
  strength_threshold: settings?.strength_threshold ?? DEFAULT_STRENGTH_THRESHOLD,
  weakness_threshold: settings?.weakness_threshold ?? DEFAULT_WEAKNESS_THRESHOLD,
  weekly_template_type: settings?.weekly_template_type ?? 1,
  created_at: settings?.created_at ?? new Date().toISOString(),
  updated_at: settings?.updated_at ?? new Date().toISOString(),
  deleted_at: settings?.deleted_at ?? null,
};
    
    return {
      ok: true,
      data: {
        ...reportSettings,
        weekly_template_type: reportSettings.weekly_template_type || 1,
        messageTone: (tenant?.message_tone as MessageTone) || 'friendly',
      },
    };
  } catch (error) {
    console.error('getReportSettings error:', error);
    return { ok: false, message: '설정을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 리포트 설정 저장
// ============================================================================

export async function updateReportSettings(params: {
  strengthThreshold: number;
  weaknessThreshold: number;
}): Promise<ActionResult<ReportSettings>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, profile } = ctx;
    
    // 관리자만 설정 변경 가능
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return { ok: false, message: '설정 변경 권한이 없습니다' };
    }
    
   // 수정 - weekly_template_type 추가
const { data, error } = await supabase
  .from('report_settings')
  .upsert({
    tenant_id: profile.tenant_id,
    strength_threshold: params.strengthThreshold,
    weakness_threshold: params.weaknessThreshold,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'tenant_id',
  })
  .select('id, tenant_id, strength_threshold, weakness_threshold, weekly_template_type, created_at, updated_at, deleted_at')
  .single();
    
    if (error) throw error;
    
    return { ok: true, data };
  } catch (error) {
    console.error('updateReportSettings error:', error);
    return { ok: false, message: '설정 저장에 실패했습니다' };
  }
}

// ============================================================================
// 메시지 톤 저장
// ============================================================================

export async function updateMessageTone(tone: MessageTone): Promise<ActionResult<{ messageTone: MessageTone }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, profile } = ctx;
    
    // 관리자만 설정 변경 가능
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return { ok: false, message: '설정 변경 권한이 없습니다' };
    }
    
    const { error } = await supabase
      .from('tenants')
      .update({ message_tone: tone })
      .eq('id', profile.tenant_id);
    
    if (error) throw error;
    
    return { ok: true, data: { messageTone: tone } };
  } catch (error) {
    console.error('updateMessageTone error:', error);
    return { ok: false, message: '톤 설정 저장에 실패했습니다' };
  }
}

// ============================================================================
// 학생 목록 조회 (리포트용)
// ============================================================================

export async function getStudentsForReport(classId?: string): Promise<ActionResult<StudentBasic[]>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, user, profile } = ctx;
    
    // teacher인 경우 can_view_reports 체크
    if (profile.role === 'teacher') {
      const { data: teacherPerm } = await supabase
        .from('teacher_permissions')
        .select('can_view_reports')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (teacherPerm && teacherPerm.can_view_reports === false) {
        return { ok: false, message: '리포트 조회 권한이 없습니다' };
      }
    }
    
    if (classId) {
      // 특정 반의 학생들
      const { data, error } = await supabase
        .from('class_members')
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
        .eq('is_active', true)
        .is('deleted_at', null);
      
      if (error) throw error;
      
      const students: StudentBasic[] = (data || [])
        .filter(item => item.students)
        .map(item => {
          const s = item.students as { id: string; name: string; display_code: string | null };
          return {
            id: s.id,
            name: s.name,
            display_code: s.display_code,
          };
        });
      
      return { ok: true, data: students };
    } else {
      // 전체 학생 (owner만)
      if (profile.role !== 'owner' && profile.role !== 'admin') {
        return { ok: false, message: '반을 선택해주세요' };
      }
      
      const { data, error } = await supabase
        .from('students')
        .select('id, name, display_code')
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      
      if (error) throw error;
      
      return { ok: true, data: data || [] };
    }
  } catch (error) {
    console.error('getStudentsForReport error:', error);
    return { ok: false, message: '학생 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 반 목록 조회 (리포트용)
// ============================================================================

export async function getClassesForReport(): Promise<ActionResult<{ id: string; name: string }[]>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, user, profile } = ctx;
    
    // teacher인 경우 can_view_reports 체크
    if (profile.role === 'teacher') {
      const { data: teacherPerm } = await supabase
        .from('teacher_permissions')
        .select('can_view_reports')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (teacherPerm && teacherPerm.can_view_reports === false) {
        return { ok: false, message: '리포트 조회 권한이 없습니다' };
      }
      
      // teacher는 담당 반만
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id, classes(id, name)')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      const classes = (assignments || [])
        .filter(a => a.classes)
        .map(a => {
          const c = a.classes as { id: string; name: string };
          return { id: c.id, name: c.name };
        });
      
      return { ok: true, data: classes };
    }
    
    // owner/admin은 전체 반
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
    if (error) throw error;
    
    return { ok: true, data: data || [] };
  } catch (error) {
    console.error('getClassesForReport error:', error);
    return { ok: false, message: '반 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 주간 리포트 생성 (개별)
// ============================================================================

export async function generateWeeklyReport(params: {
  studentId: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult<WeeklyReportData>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, profile } = ctx;
    
    const { studentId, startDate, endDate } = params;
    
    // 1. 학생 정보 조회
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, name, display_code')
      .eq('id', studentId)
      .eq('tenant_id', profile.tenant_id)
      .single();
    
    if (studentError || !student) {
      return { ok: false, message: '학생을 찾을 수 없습니다' };
    }
    
    // 2. 리포트 설정 조회
    const settingsResult = await getReportSettings();
    const settings = settingsResult.ok ? settingsResult.data : {
      strength_threshold: DEFAULT_STRENGTH_THRESHOLD,
      weakness_threshold: DEFAULT_WEAKNESS_THRESHOLD,
      messageTone: 'friendly' as MessageTone,
    };
    
    // 3. 해당 기간의 피드 데이터 조회 (정규수업만)
    const { data: feeds, error: feedsError } = await supabase
      .from('student_feeds')
      .select('id, feed_date')
      .eq('tenant_id', profile.tenant_id)
      .eq('student_id', studentId)
      .gte('feed_date', startDate)
      .lte('feed_date', endDate)
      .eq('is_makeup', false)
      .order('feed_date', { ascending: true });
    
    if (feedsError) throw feedsError;
    
    if (!feeds || feeds.length === 0) {
      return { ok: false, message: '해당 기간에 피드 데이터가 없습니다' };
    }
    
    const feedIds = feeds.map(f => f.id);
    
    // 4. 사용된 set_id만 먼저 조회 (성능 최적화)
    const { data: usedSetIdsData, error: setIdsError } = await supabase
      .from('feed_values')
      .select('set_id')
      .in('feed_id', feedIds)
      .not('set_id', 'is', null);
    
    if (setIdsError) throw setIdsError;
    
    // DISTINCT 처리 + null 필터링
    const usedSetIds = [...new Set(
      (usedSetIdsData || [])
        .map(v => v.set_id)
        .filter((id): id is string => id !== null)
    )];
    
    if (usedSetIds.length === 0) {
      return { ok: false, message: '해당 기간에 피드 데이터가 없습니다' };
    }
    
    // 5. 세트 조회 (피드 데이터에 사용된 세트들)
    const { data: usedOptionSets, error: setsError } = await supabase
      .from('feed_option_sets')
      .select('id, name, set_key, stats_category, is_scored, is_in_weekly_stats, deleted_at, created_at')
      .eq('tenant_id', profile.tenant_id)
      .in('id', usedSetIds);
    
    if (setsError) throw setsError;
    
    // 6. 현재 활성 config의 세트 조회
    const { data: activeConfig } = await supabase
      .from('feed_configs')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();
    
    let currentConfigSets: { set_key: string | null; name: string; is_in_weekly_stats: boolean | null }[] = [];
    if (activeConfig) {
      const { data: configSets } = await supabase
        .from('feed_option_sets')
        .select('set_key, name, is_in_weekly_stats')
        .eq('tenant_id', profile.tenant_id)
        .eq('config_id', activeConfig.id)
        .is('deleted_at', null);
      currentConfigSets = configSets || [];
    }
    
    const currentSettingsByKey = new Map(
      currentConfigSets.filter(s => s.set_key).map(s => [s.set_key, s.is_in_weekly_stats])
    );
    const currentSettingsByName = new Map(
      currentConfigSets.map(s => [s.name, s.is_in_weekly_stats])
    );
    
    // 현재 설정 기준으로 필터
    const statsEnabledSets = (usedOptionSets || []).filter(s => {
      if (s.set_key && currentSettingsByKey.has(s.set_key)) {
        return currentSettingsByKey.get(s.set_key) !== false;
      }
      if (currentSettingsByName.has(s.name)) {
        return currentSettingsByName.get(s.name) !== false;
      }
      return s.is_in_weekly_stats !== false;
    });
    
    if (statsEnabledSets.length === 0) {
      return { ok: false, message: '통계에 포함된 평가항목이 없습니다. 피드 설정을 확인해주세요.' };
    }
    
    // 7. 피드 값 조회
    const statsSetIds = statsEnabledSets.map(s => s.id);
    const { data: feedValues, error: valuesError } = await supabase
      .from('feed_values')
      .select('feed_id, set_id, option_id, score')
      .in('feed_id', feedIds)
      .in('set_id', statsSetIds);
    
    if (valuesError) throw valuesError;
    
    // 8. 항목 변경 시점 감지
    const dateSetGroups: { date: string; setIds: Set<string> }[] = [];
    
    for (const feed of feeds) {
      const feedSetIds = new Set(
        (feedValues || [])
          .filter(v => v.feed_id === feed.id && v.set_id)
          .map(v => v.set_id as string)
      );
      
      if (feedSetIds.size === 0) continue;
      
      const lastGroup = dateSetGroups[dateSetGroups.length - 1];
      const currentSetIdsStr = [...feedSetIds].sort().join(',');
      const lastSetIdsStr = lastGroup ? [...lastGroup.setIds].sort().join(',') : '';
      
      if (currentSetIdsStr !== lastSetIdsStr) {
        dateSetGroups.push({ date: feed.feed_date, setIds: feedSetIds });
      }
    }
    
    const configChanges: { changeDate: string; beforeItems: string[]; afterItems: string[] }[] = [];
    
    if (dateSetGroups.length > 1) {
      const setNameMap = new Map(statsEnabledSets.map(s => [s.id, s.stats_category || s.name]));
      
      for (let i = 1; i < dateSetGroups.length; i++) {
        const beforeSetIds = dateSetGroups[i - 1].setIds;
        const afterSetIds = dateSetGroups[i].setIds;
        
        configChanges.push({
          changeDate: dateSetGroups[i].date,
          beforeItems: [...beforeSetIds].map(id => setNameMap.get(id) || '알 수 없음'),
          afterItems: [...afterSetIds].map(id => setNameMap.get(id) || '알 수 없음'),
        });
      }
    }
    
    // 9. 옵션 정보 조회
    const setIds = statsEnabledSets.map(s => s.id);
    const { data: options } = await supabase
      .from('feed_options')
      .select('id, set_id, label, score')
      .in('set_id', setIds);
    
    const optionMap = new Map(options?.map(o => [o.id, o]) || []);
    
    // 10. 세트별 통계 계산
    const categoryStats: CategoryStat[] = [];
    const scoreStatsForAnalysis: { category: string; avgScore: number }[] = [];
    
    for (const set of statsEnabledSets) {
      const setValues = feedValues?.filter(v => v.set_id === set.id) || [];
      const statsCategory = set.stats_category || set.name;
      const isArchived = set.deleted_at !== null;
      
      if (set.is_scored) {
        const scores = setValues
          .map(v => {
            const opt = v.option_id ? optionMap.get(v.option_id) : null;
            return opt?.score ?? v.score ?? null;
          })
          .filter((s): s is number => s !== null);
        
        if (scores.length > 0) {
          const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          
          const stat: ScoreCategoryStat = {
            statsCategory,
            setName: set.name,
            avgScore,
            sampleCount: scores.length,
            isScored: true,
            isArchived,
          };
          categoryStats.push(stat);
          scoreStatsForAnalysis.push({ category: statsCategory, avgScore });
        }
      } else {
        const optionCounts: Record<string, { label: string; count: number }> = {};
        
        for (const v of setValues) {
          if (v.option_id) {
            const opt = optionMap.get(v.option_id);
            if (opt) {
              if (!optionCounts[v.option_id]) {
                optionCounts[v.option_id] = { label: opt.label, count: 0 };
              }
              optionCounts[v.option_id].count++;
            }
          }
        }
        
        const entries = Object.values(optionCounts);
        if (entries.length > 0) {
          const sorted = entries.sort((a, b) => b.count - a.count);
          const top = sorted[0];
          const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
          
          const stat: TextCategoryStat = {
            statsCategory,
            setName: set.name,
            topOption: top.label,
            topCount: top.count,
            totalCount,
            isScored: false,
            isArchived,
          };
          categoryStats.push(stat);
        }
      }
    }
    
    // 11. 전체 평균 계산
    const allScores = scoreStatsForAnalysis.map(s => s.avgScore);
    const overallAvgScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;
    
    // 12. 강점/보완 분석
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    for (const stat of scoreStatsForAnalysis) {
      if (stat.avgScore >= settings.strength_threshold) {
        strengths.push(stat.category);
      } else if (stat.avgScore < settings.weakness_threshold) {
        weaknesses.push(stat.category);
      }
    }
    
    const analysis: StrengthWeaknessAnalysis = {
      strengths,
      weaknesses,
      strengthThreshold: settings.strength_threshold,
      weaknessThreshold: settings.weakness_threshold,
    };
    
    // 13. 결과 반환
    const reportData: WeeklyReportData = {
      student: {
        id: student.id,
        name: student.name,
        displayCode: student.display_code,
      },
      period: {
        startDate,
        endDate,
      },
      categoryStats,
      overallAvgScore,
      analysis,
      feedCount: feeds.length,
      messageTone: settings.messageTone,
      configChanges: configChanges.length > 0 ? configChanges : undefined,
    };
    
    return { ok: true, data: reportData };
  } catch (error) {
    console.error('generateWeeklyReport error:', error);
    return { ok: false, message: '리포트 생성에 실패했습니다' };
  }
}

// ============================================================================
// 반 전체 리포트 일괄 생성
// ============================================================================

export async function generateBulkWeeklyReports(params: {
  studentIds: string[];
  startDate: string;
  endDate: string;
}): Promise<ActionResult<{ reports: WeeklyReportData[]; errorCount: number; hasConfigChanges: boolean }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error || '인증 오류가 발생했습니다' };
    }
    const { supabase, user, profile } = ctx;
    
    const { studentIds, startDate, endDate } = params;
    
    if (studentIds.length === 0) {
      return { ok: false, message: '학생을 선택해주세요' };
    }
    
    // ========== 공통 데이터 한 번만 조회 ==========
    
    // 1. 리포트 설정 조회 (공통)
    const settingsResult = await getReportSettings();
    const settings = settingsResult.ok ? settingsResult.data : {
      strength_threshold: DEFAULT_STRENGTH_THRESHOLD,
      weakness_threshold: DEFAULT_WEAKNESS_THRESHOLD,
      messageTone: 'friendly' as MessageTone,
    };
    
    // 2. 현재 활성 config 조회 (공통)
    const { data: activeConfig } = await supabase
      .from('feed_configs')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();
    
    let currentConfigSets: { set_key: string | null; name: string; is_in_weekly_stats: boolean | null }[] = [];
    if (activeConfig) {
      const { data: configSets } = await supabase
        .from('feed_option_sets')
        .select('set_key, name, is_in_weekly_stats')
        .eq('tenant_id', profile.tenant_id)
        .eq('config_id', activeConfig.id)
        .is('deleted_at', null);
      currentConfigSets = configSets || [];
    }
    
    const currentSettingsByKey = new Map(
      currentConfigSets.filter(s => s.set_key).map(s => [s.set_key, s.is_in_weekly_stats])
    );
    const currentSettingsByName = new Map(
      currentConfigSets.map(s => [s.name, s.is_in_weekly_stats])
    );
    
    // 3. teacher 권한 체크 (공통 - 한 번만)
    let allowedClassIds: string[] | null = null;
    
    if (profile.role === 'teacher') {
      const { data: teacherPerm } = await supabase
        .from('teacher_permissions')
        .select('can_view_reports')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (teacherPerm && teacherPerm.can_view_reports === false) {
        return { ok: false, message: '리포트 조회 권한이 없습니다' };
      }
      
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      allowedClassIds = (assignments || []).map(a => a.class_id).filter(Boolean) as string[];
      
      if (allowedClassIds.length === 0) {
        return { ok: false, message: '담당 반이 없습니다' };
      }
    }
    
    // 4. 학생 정보 일괄 조회
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, display_code')
      .eq('tenant_id', profile.tenant_id)
      .in('id', studentIds);
    
    if (studentsError) throw studentsError;
    
    const studentMap = new Map((students || []).map(s => [s.id, s]));
    
    // 5. teacher인 경우 담당 학생 필터링
    let validStudentIds = studentIds;
    if (allowedClassIds) {
      const { data: allowedMembers } = await supabase
        .from('class_members')
        .select('student_id')
        .eq('tenant_id', profile.tenant_id)
        .in('class_id', allowedClassIds)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      const allowedStudentIds = new Set((allowedMembers || []).map(m => m.student_id));
      validStudentIds = studentIds.filter(id => allowedStudentIds.has(id));
    }
    
    // 6. 옵션 정보 일괄 조회 (공통)
    const { data: allOptions } = await supabase
      .from('feed_options')
      .select('id, set_id, label, score')
      .eq('tenant_id', profile.tenant_id);
    
    const optionMap = new Map((allOptions || []).map(o => [o.id, o]));
    
    // ========== 학생별 리포트 생성 (병렬 처리) ==========
    
    const reports: WeeklyReportData[] = [];
    let errorCount = 0;
    let hasConfigChanges = false;
    
    // 5개씩 배치 처리
    const batchSize = 5;
    for (let i = 0; i < validStudentIds.length; i += batchSize) {
      const batch = validStudentIds.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (studentId) => {
          try {
            const student = studentMap.get(studentId);
            if (!student) {
              return { ok: false as const, message: '학생을 찾을 수 없습니다' };
            }
            
            // 피드 조회
            const { data: feeds, error: feedsError } = await supabase
              .from('student_feeds')
              .select('id, feed_date')
              .eq('tenant_id', profile.tenant_id)
              .eq('student_id', studentId)
              .gte('feed_date', startDate)
              .lte('feed_date', endDate)
              .eq('is_makeup', false)
              .order('feed_date', { ascending: true });
            
            if (feedsError) throw feedsError;
            
            if (!feeds || feeds.length === 0) {
              return { ok: false as const, message: '해당 기간에 피드 데이터가 없습니다' };
            }
            
            const feedIds = feeds.map(f => f.id);
            
            // 사용된 set_id 조회
            const { data: usedSetIdsData } = await supabase
              .from('feed_values')
              .select('set_id')
              .in('feed_id', feedIds)
              .not('set_id', 'is', null);
            
            const usedSetIds = [...new Set(
              (usedSetIdsData || [])
                .map(v => v.set_id)
                .filter((id): id is string => id !== null)
            )];
            
            if (usedSetIds.length === 0) {
              return { ok: false as const, message: '해당 기간에 피드 데이터가 없습니다' };
            }
            
            // 세트 조회
            const { data: usedOptionSets } = await supabase
              .from('feed_option_sets')
              .select('id, name, set_key, stats_category, is_scored, is_in_weekly_stats, deleted_at, created_at')
              .eq('tenant_id', profile.tenant_id)
              .in('id', usedSetIds);
            
            // 통계 활성 세트 필터링
            const statsEnabledSets = (usedOptionSets || []).filter(s => {
              if (s.set_key && currentSettingsByKey.has(s.set_key)) {
                return currentSettingsByKey.get(s.set_key) !== false;
              }
              if (currentSettingsByName.has(s.name)) {
                return currentSettingsByName.get(s.name) !== false;
              }
              return s.is_in_weekly_stats !== false;
            });
            
            if (statsEnabledSets.length === 0) {
              return { ok: false as const, message: '통계에 포함된 평가항목이 없습니다' };
            }
            
            // 피드 값 조회
            const statsSetIds = statsEnabledSets.map(s => s.id);
            const { data: feedValues } = await supabase
              .from('feed_values')
              .select('feed_id, set_id, option_id, score')
              .in('feed_id', feedIds)
              .in('set_id', statsSetIds);
            
            // 항목 변경 시점 감지
            const dateSetGroups: { date: string; setIds: Set<string> }[] = [];
            for (const feed of feeds) {
              const feedSetIds = new Set(
                (feedValues || [])
                  .filter(v => v.feed_id === feed.id && v.set_id)
                  .map(v => v.set_id as string)
              );
              if (feedSetIds.size === 0) continue;
              
              const lastGroup = dateSetGroups[dateSetGroups.length - 1];
              const currentSetIdsStr = [...feedSetIds].sort().join(',');
              const lastSetIdsStr = lastGroup ? [...lastGroup.setIds].sort().join(',') : '';
              
              if (currentSetIdsStr !== lastSetIdsStr) {
                dateSetGroups.push({ date: feed.feed_date, setIds: feedSetIds });
              }
            }
            
            const configChanges: { changeDate: string; beforeItems: string[]; afterItems: string[] }[] = [];
            if (dateSetGroups.length > 1) {
              const setNameMap = new Map(statsEnabledSets.map(s => [s.id, s.stats_category || s.name]));
              for (let j = 1; j < dateSetGroups.length; j++) {
                configChanges.push({
                  changeDate: dateSetGroups[j].date,
                  beforeItems: [...dateSetGroups[j - 1].setIds].map(id => setNameMap.get(id) || '알 수 없음'),
                  afterItems: [...dateSetGroups[j].setIds].map(id => setNameMap.get(id) || '알 수 없음'),
                });
              }
            }
            
            // 세트별 통계 계산
            const categoryStats: (ScoreCategoryStat | TextCategoryStat)[] = [];
            const scoreStatsForAnalysis: { category: string; avgScore: number }[] = [];
            
            for (const set of statsEnabledSets) {
              const setValues = feedValues?.filter(v => v.set_id === set.id) || [];
              const statsCategory = set.stats_category || set.name;
              const isArchived = set.deleted_at !== null;
              
              if (set.is_scored) {
                const scores = setValues
                  .map(v => {
                    const opt = v.option_id ? optionMap.get(v.option_id) : null;
                    return opt?.score ?? v.score ?? null;
                  })
                  .filter((s): s is number => s !== null);
                
                if (scores.length > 0) {
                  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                  categoryStats.push({
                    statsCategory,
                    setName: set.name,
                    avgScore,
                    sampleCount: scores.length,
                    isScored: true,
                    isArchived,
                  } as ScoreCategoryStat);
                  scoreStatsForAnalysis.push({ category: statsCategory, avgScore });
                }
              } else {
                const optionCounts: Record<string, { label: string; count: number }> = {};
                for (const v of setValues) {
                  if (v.option_id) {
                    const opt = optionMap.get(v.option_id);
                    if (opt?.label) {
                      if (!optionCounts[v.option_id]) {
                        optionCounts[v.option_id] = { label: opt.label, count: 0 };
                      }
                      optionCounts[v.option_id].count++;
                    }
                  }
                }
                
                const entries = Object.values(optionCounts);
                if (entries.length > 0) {
                  const sorted = entries.sort((a, b) => b.count - a.count);
                  const top = sorted[0];
                  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
                  
                  categoryStats.push({
                    statsCategory,
                    setName: set.name,
                    topOption: top.label,
                    topCount: top.count,
                    totalCount,
                    isScored: false,
                    isArchived,
                  } as TextCategoryStat);
                }
              }
            }
            
            // 강점/약점 분석
            const strengths: string[] = [];
            const weaknesses: string[] = [];
            
            for (const stat of scoreStatsForAnalysis) {
              if (stat.avgScore >= settings.strength_threshold) {
                strengths.push(stat.category);
              } else if (stat.avgScore < settings.weakness_threshold) {
                weaknesses.push(stat.category);
              }
            }
            
            const analysis: StrengthWeaknessAnalysis = {
              strengths,
              weaknesses,
              strengthThreshold: settings.strength_threshold,
              weaknessThreshold: settings.weakness_threshold,
            };
            
            // 전체 평균 계산
            const allScores = scoreStatsForAnalysis.map(s => s.avgScore);
            const overallAvgScore = allScores.length > 0
              ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
              : null;
            
            return {
              ok: true as const,
              data: {
                student: {
                  id: student.id,
                  name: student.name,
                  displayCode: student.display_code,
                },
                period: { startDate, endDate },
                categoryStats,
                overallAvgScore,
                analysis,
                feedCount: feeds.length,
                messageTone: settings.messageTone,
                configChanges,
              },
            };
          } catch (error) {
            console.error(`리포트 생성 실패 (${studentId}):`, error);
            return { ok: false as const, message: '리포트 생성에 실패했습니다' };
          }
        })
      );
      
      // 결과 처리
      for (const result of batchResults) {
        if (result.ok) {
          reports.push(result.data);
          if (result.data.configChanges && result.data.configChanges.length > 0) {
            hasConfigChanges = true;
          }
        } else {
          errorCount++;
        }
      }
    }
    
    return { 
      ok: true, 
      data: { 
        reports, 
        errorCount, 
        hasConfigChanges 
      } 
    };
  } catch (error) {
    console.error('generateBulkWeeklyReports error:', error);
    return { ok: false, message: '일괄 리포트 생성에 실패했습니다' };
  }
}