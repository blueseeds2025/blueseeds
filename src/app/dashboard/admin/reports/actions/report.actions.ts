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
// 리포트 설정 조회
// ============================================================================

export async function getReportSettings(): Promise<ActionResult<ReportSettings & { messageTone: MessageTone }>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;
    
    // report_settings 조회 (없으면 기본값)
    const { data: settings } = await supabase
      .from('report_settings')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .single();
    
    // tenant의 message_tone 조회
    const { data: tenant } = await supabase
      .from('tenants')
      .select('message_tone')
      .eq('id', profile.tenant_id)
      .single();
    
    const reportSettings: ReportSettings = settings || {
      id: '',
      tenant_id: profile.tenant_id,
      strength_threshold: 80,
      weakness_threshold: 75,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };
    
    return {
      ok: true,
      data: {
        ...reportSettings,
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
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;
    
    // 관리자만 설정 변경 가능
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return { ok: false, message: '설정 변경 권한이 없습니다' };
    }
    
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
      .select()
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
      return { ok: false, message: ctx.error };
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
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;
    
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
      // 전체 학생
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
      return { ok: false, message: ctx.error };
    }
    const { supabase, profile } = ctx;
    
    let query = supabase
      .from('classes')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
    // 교사는 담당 반만
    if (profile.role === 'teacher') {
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('tenant_id', profile.tenant_id)
        .eq('teacher_id', ctx.user.id)
        .eq('is_active', true)
        .is('deleted_at', null);
      
      const classIds = (assignments || [])
        .map(a => a.class_id)
        .filter((id): id is string => id !== null);
      
      if (classIds.length === 0) {
        return { ok: true, data: [] };
      }
      
      query = query.in('id', classIds);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return { ok: true, data: data || [] };
  } catch (error) {
    console.error('getClassesForReport error:', error);
    return { ok: false, message: '반 목록을 불러오는데 실패했습니다' };
  }
}

// ============================================================================
// 주간 리포트 데이터 생성
// ============================================================================

export async function generateWeeklyReport(params: {
  studentId: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult<WeeklyReportData>> {
  try {
    const ctx = await getAuthContext();
    if ('error' in ctx) {
      return { ok: false, message: ctx.error };
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
      strength_threshold: 80,
      weakness_threshold: 75,
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
      .eq('is_makeup', false)  // 정규수업만
      .order('feed_date', { ascending: true });
    
    if (feedsError) throw feedsError;
    
    if (!feeds || feeds.length === 0) {
      return { ok: false, message: '해당 기간에 피드 데이터가 없습니다' };
    }
    
    const feedIds = feeds.map(f => f.id);
    const feedDateMap = new Map(feeds.map(f => [f.id, f.feed_date]));
    
    // 4. 피드 값 조회 (해당 기간에 실제 데이터가 있는 것만)
    const { data: feedValues, error: valuesError } = await supabase
      .from('feed_values')
      .select('feed_id, set_id, option_id, score')
      .in('feed_id', feedIds);
    
    if (valuesError) throw valuesError;
    
    if (!feedValues || feedValues.length === 0) {
      return { ok: false, message: '해당 기간에 피드 데이터가 없습니다' };
    }
    
    // 5. 실제 데이터가 있는 set_id 추출
    const usedSetIds = [...new Set(feedValues.map(v => v.set_id).filter(Boolean))];
    
    if (usedSetIds.length === 0) {
      return { ok: false, message: '해당 기간에 피드 데이터가 없습니다' };
    }
    
    // 6. 세트 조회 (피드 데이터에 사용된 세트들)
    const { data: usedOptionSets, error: setsError } = await supabase
      .from('feed_option_sets')
      .select('id, name, stats_category, is_scored, is_in_weekly_stats, deleted_at, created_at')
      .eq('tenant_id', profile.tenant_id)
      .in('id', usedSetIds);
    
    if (setsError) throw setsError;
    
    // 7. 현재 활성 config의 세트 조회 (is_in_weekly_stats 설정 가져오기용)
    const { data: activeConfig } = await supabase
      .from('feed_configs')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();
    
    let currentConfigSets: { name: string; is_in_weekly_stats: boolean | null }[] = [];
    if (activeConfig) {
      const { data: configSets } = await supabase
        .from('feed_option_sets')
        .select('name, is_in_weekly_stats')
        .eq('config_id', activeConfig.id)
        .is('deleted_at', null);
      currentConfigSets = configSets || [];
    }
    
    // 현재 설정의 is_in_weekly_stats를 이름 기준으로 매핑
    const currentSettingsMap = new Map(
      currentConfigSets.map(s => [s.name, s.is_in_weekly_stats])
    );
    
    // 현재 설정 기준으로 필터 (이름 매칭)
    const statsEnabledSets = (usedOptionSets || []).filter(s => {
      // 현재 설정에 같은 이름이 있으면 그 설정 사용
      if (currentSettingsMap.has(s.name)) {
        return currentSettingsMap.get(s.name) !== false;
      }
      // 없으면 원래 세트의 설정 사용
      return s.is_in_weekly_stats !== false;
    });
    
    // optionSets 변수 할당 (기존 코드 호환)
    const optionSets = statsEnabledSets;
    
    if (statsEnabledSets.length === 0) {
      return { ok: false, message: '통계에 포함된 평가항목이 없습니다. 피드 설정을 확인해주세요.' };
    }
    
    // 7. 항목 변경 시점 감지
    // 날짜별로 사용된 set_id 그룹 확인
    const dateSetGroups: { date: string; setIds: Set<string> }[] = [];
    
    for (const feed of feeds) {
      const feedSetIds = new Set(
        feedValues
          .filter(v => v.feed_id === feed.id && v.set_id)
          .map(v => v.set_id as string)
      );
      
      if (feedSetIds.size === 0) continue;
      
      const lastGroup = dateSetGroups[dateSetGroups.length - 1];
      const currentSetIdsStr = [...feedSetIds].sort().join(',');
      const lastSetIdsStr = lastGroup ? [...lastGroup.setIds].sort().join(',') : '';
      
      if (currentSetIdsStr !== lastSetIdsStr) {
        // 새 그룹 시작 (항목 구성이 바뀜)
        dateSetGroups.push({ date: feed.feed_date, setIds: feedSetIds });
      }
    }
    
    // 항목 변경점 정보 생성
    const configChanges: { 
      changeDate: string; 
      beforeItems: string[]; 
      afterItems: string[] 
    }[] = [];
    
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
    
    // 7. 옵션 정보 조회 (문장형 라벨용) - 보관된 것도 포함
    const setIds = statsEnabledSets.map(s => s.id);
    const { data: options } = await supabase
      .from('feed_options')
      .select('id, set_id, label, score')
      .in('set_id', setIds);
    
    const optionMap = new Map(options?.map(o => [o.id, o]) || []);
    
    // 8. 세트별 통계 계산
    const categoryStats: CategoryStat[] = [];
    const scoreStatsForAnalysis: { category: string; avgScore: number }[] = [];
    
    for (const set of statsEnabledSets) {
      const setValues = feedValues?.filter(v => v.set_id === set.id) || [];
      const statsCategory = set.stats_category || set.name;
      const isArchived = set.deleted_at !== null;  // 보관 여부
      
      if (set.is_scored) {
        // 점수형: 평균 계산 (option에서 score 가져오기)
        const scores = setValues
          .map(v => {
            // feed_values.score가 있으면 사용, 없으면 option.score 사용
            if (v.score !== null) return v.score;
            if (v.option_id) {
              const opt = optionMap.get(v.option_id);
              return opt?.score ?? null;
            }
            return null;
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
        // 문장형: 최다 선택 옵션 계산
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
    
    // 8. 전체 평균 계산 (점수형만)
    const allScores = scoreStatsForAnalysis.map(s => s.avgScore);
    const overallAvgScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;
    
    // 9. 강점/보완 분석
    const analysis = analyzeStrengthsWeaknesses(
      scoreStatsForAnalysis,
      settings.strength_threshold,
      settings.weakness_threshold,
      settings.messageTone
    );
    
    // 10. 결과 반환
    const reportData: WeeklyReportData = {
      student: {
        id: student.id,
        name: student.name,
        displayCode: student.display_code || '',
      },
      period: {
        startDate,
        endDate,
      },
      categoryStats,
      overallAvgScore,
      analysis,
      generatedAt: new Date().toISOString(),
      configChanges: configChanges.length > 0 ? configChanges : undefined,
    };
    
    return { ok: true, data: reportData };
  } catch (error) {
    console.error('generateWeeklyReport error:', error);
    return { ok: false, message: '리포트 생성에 실패했습니다' };
  }
}

// ============================================================================
// 강점/보완 분석 헬퍼
// ============================================================================

function analyzeStrengthsWeaknesses(
  stats: { category: string; avgScore: number }[],
  strengthThreshold: number,
  weaknessThreshold: number,
  tone: MessageTone
): StrengthWeaknessAnalysis {
  const strengths = stats
    .filter(s => s.avgScore > strengthThreshold)
    .map(s => s.category);
  
  const weaknesses = stats
    .filter(s => s.avgScore < weaknessThreshold)
    .map(s => s.category);
  
  let nextGoal: string;
  
  if (weaknesses.length === 0) {
    // 보완점 없으면 랜덤 칭찬
    const praiseList = PRAISE_TEMPLATES[tone];
    const randomIndex = Math.floor(Math.random() * praiseList.length);
    nextGoal = praiseList[randomIndex];
  } else {
    // 보완점 있으면 집중 학습 목표
    const goalPrefix = tone === 'formal' ? '집중 학습 필요: ' 
                     : tone === 'friendly' ? '다음엔 이것만 신경 쓰면 돼요: '
                     : '';
    nextGoal = goalPrefix + weaknesses.join(', ') + (tone === 'formal' ? '' : ' 집중 학습');
  }
  
  return {
    strengths,
    weaknesses,
    nextGoal,
  };
}

// ============================================================================
// 반 전체 리포트 일괄 생성
// ============================================================================

export async function generateBulkWeeklyReports(params: {
  classId: string;
  startDate: string;
  endDate: string;
}): Promise<ActionResult<WeeklyReportData[]>> {
  try {
    // 반 학생 목록 조회
    const studentsResult = await getStudentsForReport(params.classId);
    if (!studentsResult.ok) {
      return { ok: false, message: studentsResult.message };
    }
    
    const students = studentsResult.data;
    if (students.length === 0) {
      return { ok: false, message: '해당 반에 학생이 없습니다' };
    }
    
    // 각 학생별 리포트 생성
    const reports: WeeklyReportData[] = [];
    const errors: string[] = [];
    
    for (const student of students) {
      const result = await generateWeeklyReport({
        studentId: student.id,
        startDate: params.startDate,
        endDate: params.endDate,
      });
      
      if (result.ok) {
        reports.push(result.data);
      } else {
        errors.push(`${student.name}: ${result.message}`);
      }
    }
    
    if (reports.length === 0) {
      return { ok: false, message: '생성된 리포트가 없습니다. ' + errors.join(', ') };
    }
    
    return { ok: true, data: reports };
  } catch (error) {
    console.error('generateBulkWeeklyReports error:', error);
    return { ok: false, message: '일괄 리포트 생성에 실패했습니다' };
  }
}