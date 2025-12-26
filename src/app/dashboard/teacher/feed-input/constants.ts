// ============================================================================
// 교사 피드 입력 상수
// ============================================================================

import { AbsenceReason } from './types';

// 결석 사유 옵션
export const ABSENCE_REASONS: { value: AbsenceReason; label: string; autoNotify: boolean }[] = [
  { value: '병결', label: '병결', autoNotify: false },
  { value: '가사', label: '가사', autoNotify: false },
  { value: '학교행사', label: '학교행사', autoNotify: false },
  { value: '무단', label: '무단', autoNotify: true },   // 자동 알림 ON
  { value: '지각', label: '지각', autoNotify: true },   // 자동 알림 ON
  { value: '기타', label: '기타 (직접 입력)', autoNotify: false },
];

// 카드 상태 색상
export const CARD_STATUS_STYLES = {
  empty: {
    border: 'border-gray-200',
    bg: 'bg-white',
    badge: null,
  },
  error: {
    border: 'border-red-400',
    bg: 'bg-red-50',
    badge: '🔴',
  },
  dirty: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-50',
    badge: '🟡',
  },
  saved: {
    border: 'border-green-400',
    bg: 'bg-green-50',
    badge: '🟢',
  },
} as const;

// 토스트 메시지
export const TOAST_MESSAGES = {
  SAVE_SUCCESS: '저장되었습니다',
  SAVE_ERROR: '저장 중 오류가 발생했습니다',
  SAVE_ALL_SUCCESS: (count: number) => `${count}명 저장 완료`,
  SAVE_ALL_PARTIAL: (success: number, fail: number) => 
    `${success}명 저장, ${fail}명 실패`,
  REQUIRED_MISSING: '필수 항목을 입력해주세요',
  ABSENCE_CONFIRM: '결석으로 저장할까요?\n(다른 항목은 저장되지 않습니다)',
  UNSAVED_WARNING: '저장하지 않은 변경사항이 있습니다.\n페이지를 나가시겠습니까?',
  MAKEUP_ADDED: (name: string) => `${name} 보강생 추가됨`,
  MAKEUP_REMOVED: (name: string) => `${name} 보강생 제거됨`,
} as const;

// 스타일 상수
export const STYLES = {
  // 슬레이트 블루 테마 (기존 피드 설정과 통일)
  PRIMARY: '#6366F1',
  PRIMARY_HOVER: '#4F46E5',
  PRIMARY_LIGHT: '#EEF2FF',
  
  // 상태 색상
  SUCCESS: '#22C55E',
  WARNING: '#EAB308',
  ERROR: '#EF4444',
  
  // 카드 최대 너비
  CARD_MIN_WIDTH: '280px',
  CARD_MAX_WIDTH: '400px',
} as const;

// 그리드 레이아웃 계산
export function calculateGridColumns(studentCount: number, containerWidth: number): number {
  // 모바일 (< 640px): 1-2열
  if (containerWidth < 640) {
    return studentCount <= 2 ? studentCount : 2;
  }
  
  // 태블릿 (640-1024px): 2-3열
  if (containerWidth < 1024) {
    if (studentCount <= 2) return studentCount;
    if (studentCount <= 6) return 3;
    return 3;
  }
  
  // 데스크탑: 학생 수 기반 최적화
  if (studentCount <= 2) return studentCount;
  if (studentCount <= 4) return 2;
  if (studentCount <= 6) return 3;
  if (studentCount <= 8) return 4;
  if (studentCount <= 10) return 5;
  return 5; // 최대 5열
}

// Tailwind 그리드 클래스 매핑
export function getGridClass(columns: number): string {
  const gridMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  };
  return gridMap[columns] || 'grid-cols-3';
}

// 초성 검색용 한글 분리
export function getChosung(str: string): string {
  const CHOSUNG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) - 0xAC00;
    if (code >= 0 && code <= 11171) {
      result += CHOSUNG[Math.floor(code / 588)];
    } else {
      result += str[i];
    }
  }
  return result;
}

// 초성 검색 필터
export function filterByChosung(items: { label: string }[], query: string): typeof items {
  if (!query) return items;
  
  const lowerQuery = query.toLowerCase();
  const chosungQuery = getChosung(query);
  
  return items.filter(item => {
    const label = item.label.toLowerCase();
    const labelChosung = getChosung(item.label);
    
    // 일반 검색 또는 초성 검색
    return label.includes(lowerQuery) || labelChosung.includes(chosungQuery);
  });
}

// Idempotency Key 생성
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// 날짜 포맷 (YYYY-MM-DD)
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 날짜 표시 포맷 (12월 27일 (금))
export function formatDisplayDate(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}월 ${day}일 (${dayOfWeek})`;
}
