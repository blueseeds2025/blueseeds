// ============================================================================
// 주간 리포트 관련 타입 정의
// ============================================================================

// 메시지 톤 타입
export type MessageTone = 'formal' | 'friendly' | 'concise';

// 리포트 스타일 템플릿 타입
export type ReportStyleTemplate = 'simple' | 'block' | 'slider' | 'heart';

// 리포트 기간 프리셋
export type PeriodPreset = '1week' | '2weeks' | '1month' | 'custom';

// ============================================================================
// 리포트 설정 (테넌트별)
// ============================================================================

export interface ReportSettings {
  id: string;
  tenant_id: string;
  strength_threshold: number;   // 강점 기준 (기본 80)
  weakness_threshold: number;   // 보완 기준 (기본 75)
  created_at: string | null;    // ✅ nullable로 변경
  updated_at: string | null;    // ✅ nullable로 변경
  deleted_at: string | null;
}

// ============================================================================
// 주간 리포트 데이터 구조
// ============================================================================

// 점수형 카테고리 통계
export interface ScoreCategoryStat {
  statsCategory: string;      // 통계 카테고리명 (단어, 숙제 등)
  setName: string;            // 세트 이름
  avgScore: number;           // 평균 점수
  sampleCount: number;        // 샘플 수
  isScored: true;
  isArchived?: boolean;       // 보관된 항목 여부
}

// 문장형 카테고리 통계
export interface TextCategoryStat {
  statsCategory: string;
  setName: string;
  topOption: string;          // 최다 선택 옵션
  topCount: number;           // 최다 선택 횟수
  totalCount: number;         // 전체 횟수
  isScored: false;
  isArchived?: boolean;       // 보관된 항목 여부
}

export type CategoryStat = ScoreCategoryStat | TextCategoryStat;

// 강점/보완 분석 결과
export interface StrengthWeaknessAnalysis {
  strengths: string[];        // 강점 카테고리 목록
  weaknesses: string[];       // 보완 카테고리 목록
  strengthThreshold: number;  // 강점 기준점
  weaknessThreshold: number;  // 보완 기준점
}

// 항목 변경점 정보
export interface ConfigChange {
  changeDate: string;          // 변경 시작 날짜
  beforeItems: string[];       // 변경 전 항목들
  afterItems: string[];        // 변경 후 항목들
}

// 주간 리포트 전체 데이터
export interface WeeklyReportData {
  student: {
    id: string;
    name: string;
    displayCode: string | null;  // ✅ nullable로 변경
  };
  period: {
    startDate: string;        // YYYY-MM-DD
    endDate: string;
  };
  categoryStats: CategoryStat[];
  overallAvgScore: number | null;    // 전체 평균 (점수형만)
  analysis: StrengthWeaknessAnalysis;
  feedCount: number;                  // ✅ 추가
  messageTone: MessageTone;           // ✅ 추가
  configChanges?: ConfigChange[];     // 항목 변경점 (있으면)
}

// ============================================================================
// 리포트 생성 요청 파라미터
// ============================================================================

export interface GenerateReportParams {
  studentId: string;
  startDate: string;          // YYYY-MM-DD
  endDate: string;
}

export interface GenerateReportBulkParams {
  classId: string;
  startDate: string;
  endDate: string;
}

// ============================================================================
// 칭찬 문구 템플릿 (톤별)
// ============================================================================

export const PRAISE_TEMPLATES: Record<MessageTone, string[]> = {
  formal: [
    '이번 기간 동안 모든 영역에서 균형 잡힌 학습을 보여주었습니다. 꾸준함을 유지하는 것이 가장 큰 강점입니다.',
    '특별히 보완할 부분 없이 모든 학습 목표를 성실하게 완수하였습니다. 지금처럼 계속해 주시기 바랍니다.',
    '모든 평가 항목에서 안정적인 성취도를 보이며 꾸준히 성장하고 있습니다. 훌륭한 학습 태도입니다.',
    '약점 없이 모든 영역을 고르게 발전시키고 있습니다. 다음 기간도 지금의 좋은 흐름을 이어가시길 바랍니다.',
  ],
  friendly: [
    '이번에도 정말 잘했어요! 모든 영역에서 골고루 잘하고 있어서 칭찬해요~ 이대로만 쭉 가면 돼요!',
    '빈틈없이 꼼꼼하게 잘 해냈어요! 특별히 더 신경 쓸 부분이 없네요. 다음에도 파이팅!',
    '와~ 전 영역에서 고르게 잘하고 있어요! 꾸준히 노력하는 모습이 정말 멋져요!',
    '보완할 부분 없이 모두 잘 해냈어요! 이렇게만 계속 해주면 선생님이 너무 행복해요~',
  ],
  concise: [
    '모든 항목 양호. 현재 학습 유지 바람.',
    '보완 사항 없음. 꾸준히 유지.',
    '전 영역 안정적. 현 상태 유지.',
    '특이사항 없음. 좋은 흐름 유지.',
  ],
};

// ============================================================================
// 리포트 텍스트 템플릿
// ============================================================================

export const REPORT_INTRO_TEMPLATES: Record<MessageTone, string> = {
  formal: `안녕하세요, {startDate}~{endDate} {studentName} 학생의 학습 태도와 성과 안내입니다.

이번 리포트는 단순한 점수표가 아니라 지난 기간 동안 어떤 부분이 힘들었는지 돌아보고, 다음에는 무엇을 하나 더 신경 쓰면 좋을지 아이와 함께 작은 목표를 세우는 기회로 삼아 주시길 바랍니다.
점수는 성적을 평가하기 위한 것이 아니라 아이들의 성실한 참여와 꾸준한 학습 태도를 확인하기 위한 자료입니다.`,

  friendly: `안녕하세요~ {startDate}~{endDate} {studentName} 학생 리포트 보내드려요!

점수는 아이의 성실한 참여도를 보는 자료예요. 아이와 함께 "이번에 뭐가 힘들었어?" 이야기 나눠보시고, 작은 목표 하나 세워보시면 좋을 것 같아요!`,

  concise: `{startDate}~{endDate} {studentName} 학습 리포트`,
};

// ============================================================================
// 게이지 생성 유틸리티
// ============================================================================

/**
 * 점수에 따른 색상 이모지 반환
 */
export function getScoreEmoji(score: number): string {
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

/**
 * 점수를 블록 게이지로 변환 (기존 방식 + 색상)
 */
export function scoreToBlockGauge(score: number, maxBlocks: number = 10): string {
  const filled = Math.round((score / 100) * maxBlocks);
  const empty = maxBlocks - filled;
  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

/**
 * 점수를 슬라이더 게이지로 변환
 */
export function scoreToSliderGauge(score: number, totalSlots: number = 10): string {
  const lineChar = '━';   // 굵은 선 (채워짐)
  const thumbChar = '●';  // 손잡이 (현재 점수)
  const emptyChar = '─';  // 얇은 선 (빈 공간)
  
  let level = Math.floor(score / 10);
  if (level > 10) level = 10;
  if (level < 0) level = 0;
  
  if (level === 0) {
    return thumbChar + emptyChar.repeat(totalSlots - 1);
  }
  
  const lines = lineChar.repeat(level - 1);
  const track = emptyChar.repeat(totalSlots - level);
  return lines + thumbChar + track;
}

/**
 * 점수를 하트 게이지로 변환 (5개 기준)
 */
export function scoreToHeartGauge(score: number, maxHearts: number = 5): string {
  const filled = Math.round((score / 100) * maxHearts);
  const empty = maxHearts - filled;
  return '❤️'.repeat(filled) + '🤍'.repeat(empty);
}

/**
 * 기존 함수 (하위 호환)
 */
export function scoreToGauge(score: number, maxBlocks: number = 10): string {
  return scoreToBlockGauge(score, maxBlocks);
}

/**
 * 빈도를 도트 문자열로 변환
 * @param count 선택된 횟수
 * @param total 전체 횟수
 */
export function countToDots(count: number, total: number): string {
  return '●'.repeat(count) + '○'.repeat(total - count);
}

// ============================================================================
// 카테고리별 이모지 (하트 템플릿용)
// ============================================================================

export const CATEGORY_EMOJIS: Record<string, string> = {
  '학습 태도': '💗',
  '태도': '💗',
  '이해도': '🧠',
  '이해': '🧠',
  '숙제': '📝',
  '단어': '📚',
  '학습 지속도': '🔥',
  '지속도': '🔥',
  '끈기': '🔥',
};

export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJIS[category] || '📊';
}

// ============================================================================
// 스타일 템플릿 정보
// ============================================================================

export const STYLE_TEMPLATE_INFO: Record<ReportStyleTemplate, { name: string; description: string; example: string }> = {
  simple: {
    name: '심플',
    description: '깔끔한 점수만 표시',
    example: '🟢 학습 태도  93',
  },
  block: {
    name: '블록',
    description: '채워진 블록으로 표시',
    example: '🟢 93 ▰▰▰▰▰▰▰▰▰▱',
  },
  slider: {
    name: '슬라이더',
    description: '진행 바 형태로 표시',
    example: '🟢 93 ━━━━━━━━━●',
  },
  heart: {
    name: '하트',
    description: '하트로 부드럽게 표시',
    example: '💗 (93) ❤️❤️❤️❤️❤️',
  },
};

// ============================================================================
// 톤 표시 정보
// ============================================================================

export const TONE_INFO: Record<MessageTone, { name: string; description: string }> = {
  formal: {
    name: '정중',
    description: '격식체, ~습니다 스타일',
  },
  friendly: {
    name: '친근',
    description: '부드러운 존댓말, ~해요 스타일',
  },
  concise: {
    name: '간결',
    description: '짧고 명확한 스타일',
  },
};