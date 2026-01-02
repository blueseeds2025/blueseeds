// ============================================================================
// 통합 설정 페이지 타입 정의
// ============================================================================

// 메시지 톤
export type MessageTone = 'formal' | 'friendly' | 'casual';

// 주간 리포트 템플릿 (1~3)
export type WeeklyTemplateType = 1 | 2 | 3;

// 월간 리포트 템플릿 (1~5)
export type MonthlyTemplateType = 1 | 2 | 3 | 4 | 5;

// ----------------------------------------------------------------------------
// 학원 정보 (tenants)
// ----------------------------------------------------------------------------
export interface AcademyInfo {
  id: string;
  name: string;           // 학원 코드명
  display_name: string;   // 학원 표시명
  phone: string | null;   // 연락처
  curriculum: string | null;  // 학원 소개/커리큘럼 (AI용)
  message_tone: MessageTone;  // 말투
  plan: string;           // 요금제
}

// ----------------------------------------------------------------------------
// 리포트 설정 (report_settings)
// ----------------------------------------------------------------------------
export interface ReportSettingsData {
  id: string;
  tenant_id: string;
  strength_threshold: number;      // 강점 기준 (기본 80)
  weakness_threshold: number;      // 약점 기준 (기본 75)
  weekly_template_type: WeeklyTemplateType;   // 주간 템플릿
  monthly_template_type: MonthlyTemplateType; // 월간 템플릿
}

// ----------------------------------------------------------------------------
// 통합 설정 데이터
// ----------------------------------------------------------------------------
export interface SettingsData {
  academy: AcademyInfo;
  report: ReportSettingsData;
  stats: {
    teacherCount: number;
    studentCount: number;
    feedSetCount: number;
    unmappedCategoryCount: number;  // stats_category 미지정 개수
  };
}

// ----------------------------------------------------------------------------
// Setup Health 체크 항목
// ----------------------------------------------------------------------------
export interface SetupHealthItem {
  key: string;
  label: string;
  status: 'complete' | 'warning' | 'error';
  message?: string;
}

export interface SetupHealth {
  items: SetupHealthItem[];
  overallStatus: 'complete' | 'incomplete';
}

// ----------------------------------------------------------------------------
// 폼 입력 타입
// ----------------------------------------------------------------------------

// 학원 정보 수정
export interface UpdateAcademyInput {
  display_name?: string;
  phone?: string;
  curriculum?: string;
  message_tone?: MessageTone;
}

// 리포트 설정 수정
export interface UpdateReportSettingsInput {
  strength_threshold?: number;
  weakness_threshold?: number;
  weekly_template_type?: WeeklyTemplateType;
  monthly_template_type?: MonthlyTemplateType;
}

// ----------------------------------------------------------------------------
// 상수
// ----------------------------------------------------------------------------

export const MESSAGE_TONE_OPTIONS: { value: MessageTone; label: string; description: string }[] = [
  { value: 'formal', label: '격식체', description: '~습니다, ~입니다' },
  { value: 'friendly', label: '친근한 존댓말', description: '~해요, ~예요' },
  { value: 'casual', label: '반말', description: '~해, ~야' },
];

export const WEEKLY_TEMPLATE_OPTIONS: { value: WeeklyTemplateType; label: string; description: string }[] = [
  { value: 1, label: '간단 요약형', description: '핵심 내용만 짧게' },
  { value: 2, label: '상세형', description: '영역별 자세한 분석' },
  { value: 3, label: '감성형', description: '이모지와 따뜻한 문구' },
];

export const MONTHLY_TEMPLATE_OPTIONS: { value: MonthlyTemplateType; label: string; description: string; target: string }[] = [
  { value: 1, label: '정석 리포트', description: '문단형 코멘트 중심', target: '영어/수학 전문학원' },
  { value: 2, label: '데이터 분석', description: '점수와 차트 중심', target: '입시/결과 중심 학원' },
  { value: 3, label: '키워드/성장', description: '감성적 성장 스토리', target: '초등 저학년/공부방' },
  { value: 4, label: '데일리 로그', description: '출석과 진도 캘린더', target: '보습학원/자기주도학습' },
  { value: 5, label: '1분 요약', description: '핵심만 간결하게', target: '맞벌이/1인 교습소' },
];
