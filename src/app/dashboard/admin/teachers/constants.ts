// ============================================================================
// 교사 관리 상수
// ============================================================================

/** 교사 색상 팔레트 (시간표 표시용) */
export const TEACHER_COLORS = [
  { value: '#6366F1', label: '인디고' },
  { value: '#8B5CF6', label: '바이올렛' },
  { value: '#EC4899', label: '핑크' },
  { value: '#EF4444', label: '레드' },
  { value: '#F97316', label: '오렌지' },
  { value: '#EAB308', label: '옐로우' },
  { value: '#22C55E', label: '그린' },
  { value: '#14B8A6', label: '틸' },
  { value: '#06B6D4', label: '시안' },
  { value: '#3B82F6', label: '블루' },
  { value: '#6B7280', label: '그레이' },
  { value: '#78716C', label: '스톤' },
] as const;

/** 기본 교사 색상 */
export const DEFAULT_TEACHER_COLOR = '#6366F1';

/** 교사 역할 */
export const TEACHER_ROLES = {
  primary: '담임',
  assistant: '보조',
} as const;

/** 스타일 상수 */
export const styles = {
  // 색상
  colors: {
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    primaryLight: '#EEF2FF',
    danger: '#DC2626',
    dangerHover: '#B91C1C',
    dangerLight: '#FEF2F2',
    success: '#22C55E',
    successLight: '#F0FDF4',
    text: '#37352F',
    textMuted: '#9B9A97',
    border: '#E8E5E0',
    background: '#FAFAF9',
    white: '#FFFFFF',
  },
  
  // 카드
  card: {
    base: 'bg-white rounded-lg border border-[#E8E5E0] p-4 hover:border-[#6366F1] transition-colors',
    header: 'flex items-center justify-between mb-3',
  },
  
  // 버튼
  button: {
    primary: 'bg-[#6366F1] hover:bg-[#4F46E5] text-white px-4 py-2 rounded-lg font-medium transition-colors',
    secondary: 'bg-white hover:bg-gray-50 text-[#37352F] px-4 py-2 rounded-lg border border-[#E8E5E0] font-medium transition-colors',
    danger: 'bg-[#DC2626] hover:bg-[#B91C1C] text-white px-4 py-2 rounded-lg font-medium transition-colors',
    icon: 'p-2 rounded-lg hover:bg-gray-100 transition-colors',
  },
  
  // 입력
  input: {
    base: 'w-full px-3 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent',
  },
  
  // 뱃지
  badge: {
    base: 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
    primary: 'bg-[#EEF2FF] text-[#6366F1]',
    gray: 'bg-gray-100 text-gray-600',
    success: 'bg-[#F0FDF4] text-[#22C55E]',
  },
  
  // 모달
  modal: {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
    content: 'bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto',
    title: 'text-lg font-semibold text-[#37352F] mb-4',
  },
} as const;

/** 토스트 메시지 */
export const TOAST_MESSAGES = {
  // 성공
  teacherUpdated: '교사 정보가 수정되었습니다',
  colorUpdated: '색상이 변경되었습니다',
  permissionsUpdated: '권한이 저장되었습니다',
  classAssigned: '반이 배정되었습니다',
  classUnassigned: '반 배정이 해제되었습니다',
  
  // 에러
  loadFailed: '데이터를 불러오는데 실패했습니다',
  saveFailed: '저장에 실패했습니다',
} as const;
