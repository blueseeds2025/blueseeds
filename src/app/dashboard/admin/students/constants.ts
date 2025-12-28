// ============================================================================
// 학생 관리 상수 및 스타일
// ============================================================================

/** 공통 스타일 */
export const styles = {
  // 카드
  card: {
    base: 'bg-white rounded-lg border border-[#E8E5E0] p-4 hover:shadow-md transition-shadow cursor-pointer',
    selected: 'bg-white rounded-lg border-2 border-[#6366F1] p-4 shadow-md',
  },
  
  // 버튼
  button: {
    primary: 'px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] transition-colors font-medium',
    secondary: 'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium',
    danger: 'px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium',
    ghost: 'px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors',
  },
  
  // 입력 필드
  input: {
    base: 'w-full px-3 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent',
    error: 'w-full px-3 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500',
  },
  
  // 라벨
  label: 'block text-sm font-medium text-[#37352F] mb-1',
  
  // 배지
  badge: {
    active: 'px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700',
    inactive: 'px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500',
    class: 'px-2 py-1 text-xs rounded-full',
  },
  
  // 텍스트
  text: {
    primary: 'text-[#37352F]',
    secondary: 'text-[#9B9A97]',
    muted: 'text-gray-400',
  },
} as const;

/** 검색 필터 옵션 */
export const FILTER_OPTIONS = {
  status: [
    { value: 'all', label: '전체' },
    { value: 'active', label: '재원생' },
    { value: 'inactive', label: '퇴원생' },
  ],
  grade: [
    { value: 'all', label: '전체 학년' },
    { value: 'elementary', label: '초등' },
    { value: 'middle', label: '중등' },
    { value: 'high', label: '고등' },
  ],
} as const;

/** 학년 그룹 판별 */
export function getGradeGroup(grade: number | null): 'elementary' | 'middle' | 'high' | null {
  if (grade === null) return null;
  if (grade >= 1 && grade <= 6) return 'elementary';
  if (grade >= 7 && grade <= 9) return 'middle';
  if (grade >= 10 && grade <= 12) return 'high';
  return null;
}

/** display_code 자동 생성 (이름 + 랜덤 4자리) */
export function generateDisplayCode(name: string): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${name}${randomNum}`;
}
