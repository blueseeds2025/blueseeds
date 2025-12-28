// ============================================================================
// 프리미엄/기능 잠금 관련 색상 상수
// ============================================================================

export const PREMIUM_COLORS = {
  // 프리미엄 브랜드 색상
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  primaryLight: '#F3E8FF',
  
  // 텍스트
  text: '#7C3AED',
  textMuted: '#6B7280',
  
  // 배경
  background: '#F3E8FF',
  backgroundOverlay: 'rgba(255, 255, 255, 0.8)',
  
  // 상태 표시
  locked: {
    bg: '#F3E8FF',
    text: '#7C3AED',
    border: '#E5E7EB',
  },
} as const;

// Tailwind 클래스로 사용할 경우
export const PREMIUM_CLASSES = {
  button: 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white',
  badge: 'bg-[#F3E8FF] text-[#7C3AED]',
  icon: 'text-[#7C3AED]',
} as const;
