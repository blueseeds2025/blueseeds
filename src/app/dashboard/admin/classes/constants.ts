// ============================================================================
// 반 관리 상수
// ============================================================================

/** 반 색상 팔레트 (시간표용 - 선명한 원색) */
export const CLASS_COLORS = [
  { value: '#EF4444', label: '빨강' },
  { value: '#F97316', label: '주황' },
  { value: '#84CC16', label: '연두' },
  { value: '#16A34A', label: '초록' },
  { value: '#06B6D4', label: '하늘' },
  { value: '#6366F1', label: '인디고' },
  { value: '#1E40AF', label: '남색' },
  { value: '#8B5CF6', label: '보라' },
  { value: '#EC4899', label: '분홍' },
  { value: '#374151', label: '검정' },
] as const;

/** 기본 반 색상 */
export const DEFAULT_CLASS_COLOR = '#6366F1';

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
  },
  
  // 모달
  modal: {
    overlay: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
    content: 'bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6',
    title: 'text-lg font-semibold text-[#37352F] mb-4',
  },
} as const;

/** 토스트 메시지 */
export const TOAST_MESSAGES = {
  // 성공
  classCreated: '반이 생성되었습니다',
  classUpdated: '반 정보가 수정되었습니다',
  classDeleted: '반이 삭제되었습니다',
  teacherAssigned: '교사가 배정되었습니다',
  teacherUnassigned: '교사 배정이 해제되었습니다',
  studentEnrolled: '학생이 등록되었습니다',
  studentUnenrolled: '학생 등록이 해제되었습니다',
  
  // 에러
  loadFailed: '데이터를 불러오는데 실패했습니다',
  saveFailed: '저장에 실패했습니다',
  deleteFailed: '삭제에 실패했습니다',
} as const;
