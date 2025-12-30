// ============================================================================
// 주간 리포트 상수
// ============================================================================

// 기간 프리셋
export const PERIOD_PRESETS = {
  '1week': {
    label: '최근 1주',
    days: 7,
  },
  '2weeks': {
    label: '최근 2주',
    days: 14,
  },
  '1month': {
    label: '최근 1달',
    days: 30,
  },
} as const;

// 기본값
export const DEFAULT_STRENGTH_THRESHOLD = 80;
export const DEFAULT_WEAKNESS_THRESHOLD = 75;

// 토스트 메시지
export const TOAST_MESSAGES = {
  REPORT_GENERATED: '리포트가 생성되었습니다',
  REPORT_COPIED: '리포트가 클립보드에 복사되었습니다',
  REPORT_COPY_FAILED: '복사에 실패했습니다. 직접 선택해서 복사해주세요.',
  NO_STUDENT_SELECTED: '학생을 선택해주세요',
  NO_DATE_SELECTED: '기간을 선택해주세요',
  SETTINGS_SAVED: '설정이 저장되었습니다',
} as const;

// 색상 (게이지 표시용)
export const GAUGE_COLORS = {
  high: '#22C55E',    // 초록 (80점 이상)
  medium: '#F59E0B',  // 주황 (60~79점)
  low: '#EF4444',     // 빨강 (60점 미만)
} as const;

// 점수별 색상 판단
export function getScoreColor(score: number): string {
  if (score >= 80) return GAUGE_COLORS.high;
  if (score >= 60) return GAUGE_COLORS.medium;
  return GAUGE_COLORS.low;
}

// 날짜 계산 헬퍼
export function getDateRange(preset: keyof typeof PERIOD_PRESETS): {
  startDate: string;
  endDate: string;
} {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - PERIOD_PRESETS[preset].days + 1);
  
  return {
    startDate: formatDateISO(startDate),
    endDate: formatDateISO(endDate),
  };
}

// ISO 날짜 포맷 (YYYY-MM-DD)
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 한글 날짜 포맷 (M월D일)
export function formatDateKoreanShort(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월${date.getDate()}일`;
}
