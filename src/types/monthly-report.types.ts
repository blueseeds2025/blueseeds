// ============================================================================
// 월간 리포트 타입 정의
// ============================================================================

// 리포트 상태
export type ReportStatus = 'draft' | 'generated' | 'reviewed' | 'sent';

// 템플릿 타입 (1~5)
export type TemplateType = 1 | 2 | 3 | 4 | 5;

// 발송 방법
export type SendMethod = 'kakao' | 'pdf' | 'print';

// ----------------------------------------------------------------------------
// 집계 데이터 타입
// ----------------------------------------------------------------------------

export interface AttendanceSummary {
  total_days: number;
  attended: number;
  late: number;
  absent: number;
  rate: number;
}

export interface ScoreSummary {
  [category: string]: {
    average: number;
    count: number;
    trend?: 'up' | 'down' | 'stable';
  };
}

export interface TextSummary {
  [category: string]: {
    [label: string]: number;
  };
}

export interface ProgressItem {
  week: number;
  content: string;
  note?: string;
}

// 시험 점수 개별 기록
export interface ExamScoreRecord {
  date: string;
  examName: string;
  score: number;
}

// 시험 점수 요약 (Basic용)
export interface ExamSummary {
  average: number;
  highest: { score: number; date: string; examName: string } | null;
  lowest: { score: number; date: string; examName: string } | null;
  count: number;
}

// 시험 점수 상세 (Premium용)
export interface ExamScoreDetail {
  summary: ExamSummary;
  records: ExamScoreRecord[];
}

// ----------------------------------------------------------------------------
// 메인 타입 (DB Json 타입 허용)
// ----------------------------------------------------------------------------

export interface MonthlyReport {
  id: string;
  tenant_id: string;
  student_id: string;
  report_year: number;
  report_month: number;
  template_type: TemplateType;
  attendance_summary: AttendanceSummary | Record<string, unknown>;
  score_summary: ScoreSummary | Record<string, unknown>;
  progress_summary: ProgressItem[] | unknown[];
  exam_summary: ExamScoreDetail | Record<string, unknown>;
  ai_study_comment: string | null;
  ai_attitude_comment: string | null;
  ai_attendance_comment: string | null;
  ai_next_goal: string | null;
  teacher_praise: string | null;
  teacher_improve: string | null;
  teacher_comment: string | null;
  parent_message: string | null;
  status: ReportStatus;
  sent_at: string | null;
  sent_method: SendMethod | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MonthlyReportWithStudent extends MonthlyReport {
  student: {
    id: string;
    name: string;
    class_id?: string;
  } | null;
  class?: {
    id: string;
    name: string;
  } | null;
  creator?: {
    id: string;
    name: string;
  } | null;
}

// ----------------------------------------------------------------------------
// 폼/입력 타입
// ----------------------------------------------------------------------------

export interface CreateMonthlyReportInput {
  student_id: string;
  report_year: number;
  report_month: number;
  template_type?: TemplateType;
}

export interface UpdateMonthlyReportInput {
  template_type?: TemplateType;
  teacher_praise?: string | null;
  teacher_improve?: string | null;
  teacher_comment?: string | null;
  parent_message?: string | null;
  status?: ReportStatus;
}

export interface GenerateAICommentInput {
  report_id: string;
  regenerate?: boolean;
}

export interface SendReportInput {
  report_id: string;
  method: SendMethod;
}

// ----------------------------------------------------------------------------
// 필터/조회 타입
// ----------------------------------------------------------------------------

export interface MonthlyReportFilter {
  year?: number;
  month?: number;
  class_id?: string;
  student_id?: string;
  status?: ReportStatus;
}

export interface MonthlyReportListResult {
  reports: MonthlyReportWithStudent[];
  total: number;
}

// ----------------------------------------------------------------------------
// 템플릿 정보
// ----------------------------------------------------------------------------

export interface TemplateInfo {
  type: TemplateType;
  name: string;
  description: string;
  target: string;
  features: string[];
}

export const TEMPLATE_INFO: TemplateInfo[] = [
  {
    type: 1,
    name: '정석 리포트',
    description: '문단형 코멘트 중심의 표준 리포트',
    target: '영어/수학 전문학원',
    features: ['월간 학습 목표', '영역별 상세 코멘트', '선생님 총평'],
  },
  {
    type: 2,
    name: '데이터 분석',
    description: '점수와 차트 중심의 분석 리포트',
    target: '입시/결과 중심 학원',
    features: ['출석률/숙제완수율 지표', '영역별 점수 바 차트', '약점 분석 & 솔루션'],
  },
  {
    type: 3,
    name: '키워드/성장',
    description: '감성적인 성장 스토리 리포트',
    target: '초등 저학년/공부방',
    features: ['이달의 키워드 해시태그', 'Best Day 하이라이트', '선생님 칭찬 편지'],
  },
  {
    type: 4,
    name: '데일리 로그',
    description: '출석과 진도 중심의 캘린더 리포트',
    target: '보습학원/자기주도학습',
    features: ['출석 캘린더', '주간 진도 요약', '습관 지수'],
  },
  {
    type: 5,
    name: '1분 요약',
    description: '핵심만 담은 간결한 리포트',
    target: '맞벌이/1인 교습소',
    features: ['3줄 요약', 'Next Step', '행정 안내'],
  },
];

// ----------------------------------------------------------------------------
// 상태 정보
// ----------------------------------------------------------------------------

export const STATUS_INFO: Record<ReportStatus, { label: string; color: string }> = {
  draft: { label: '작성중', color: 'gray' },
  generated: { label: 'AI 생성완료', color: 'blue' },
  reviewed: { label: '검토완료', color: 'amber' },
  sent: { label: '발송완료', color: 'green' },
};