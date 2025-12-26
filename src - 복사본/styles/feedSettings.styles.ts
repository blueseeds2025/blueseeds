// styles/feedSettings.styles.ts
// FeedSettingsPage 전용 스타일 상수
// 🎨 따뜻한 노션 스타일

// ========== 색상 팔레트 ==========
export const colors = {
  // 배경
  pageBg: 'bg-[#FAFAF9]',
  cardBg: 'bg-white',
  hoverBg: 'hover:bg-[#F7F6F3]',
  
  // 테두리
  border: 'border-[#E8E5E0]',
  borderHover: 'hover:border-[#D4D1CC]',
  
  // 텍스트
  textPrimary: 'text-[#37352F]',
  textSecondary: 'text-[#9B9A97]',
  textMuted: 'text-[#B4B4B4]',
  
  // 포인트 (밝은 파스텔 오렌지)
  accent: 'bg-[#6366F1]',
  accentHover: 'hover:bg-[#4F46E5]',
  accentText: 'text-[#6366F1]',
  accentLight: 'bg-[#EEF2FF]',
  accentBorder: 'border-[#6366F1]',
  
  // 위험 (삭제)
  danger: 'text-red-600',
  dangerBg: 'bg-red-600',
  dangerHover: 'hover:bg-red-700',
  dangerLight: 'bg-red-50',
  
  // 성공
  success: 'text-green-600',
  successBg: 'bg-green-600',
} as const;

export const feedStyles = {
  // ========== 버튼 ==========
  button: {
    // Primary (라벤더)
    primary: `px-5 py-2.5 rounded-lg ${colors.accent} ${colors.accentHover} text-white font-medium transition-all`,
    primaryLarge: `flex items-center gap-2 px-5 py-3 rounded-lg ${colors.accent} ${colors.accentHover} text-white font-medium shadow-sm transition-all`,
    
    // Secondary (테두리만)
    secondary: `px-4 py-2 rounded-lg border ${colors.border} ${colors.textPrimary} ${colors.hoverBg} transition-all`,
    
    // Ghost (투명)
    ghost: `${colors.textSecondary} ${colors.hoverBg} rounded-lg transition-all`,
    ghostSmall: `p-2 ${colors.textSecondary} ${colors.hoverBg} rounded-lg transition-all`,
    
    // Danger (빨간색)
    danger: `px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all`,
    dangerSolid: `${colors.dangerBg} ${colors.dangerHover} text-white`,
    
    // Icon 버튼
    iconEdit: `${colors.textMuted} hover:text-[#6366F1] transition-colors`,
    iconDelete: `${colors.textMuted} hover:text-red-500 transition-colors`,
    iconConfirm: `${colors.success}`,
    iconCancel: `${colors.textMuted}`,
    
    // 편집 모드 토글
    editModeOn: `px-3 py-1.5 text-sm rounded-lg ${colors.accent} text-white`,
    editModeOff: `px-3 py-1.5 text-sm rounded-lg border ${colors.border} ${colors.textSecondary} ${colors.hoverBg}`,
    
    // 템플릿 선택 버튼
    templateSelect: `h-20 flex flex-col gap-1 border ${colors.border} rounded-xl ${colors.hoverBg} transition-all`,
    scoringSelect: "h-16",
    iconSquare: "h-10 w-10 rounded-lg", 
    modalCancelFull: "w-full mt-4",
  },

  // ========== 카드 ==========
  card: {
    base: `${colors.cardBg} border ${colors.border} rounded-xl shadow-sm hover:shadow-md transition-shadow`,
    inactive: "opacity-60 bg-[#F7F6F3]",
    
    // 모달/강조 카드
    modal: `mb-6 border ${colors.border} rounded-xl shadow-lg`,
    modalSlideShort: `mb-6 border ${colors.border} rounded-xl shadow-lg`,
    modalAccent: `border-[#6366F1]`,
    modalGray: `border-[#E8E5E0]`,
    modalPlain: `border-[#E8E5E0]`,
    
    // 템플릿 선택 카드
    templateCard: `cursor-pointer rounded-xl border ${colors.border} transition-all`,
    templateCustom: "hover:border-[#6366F1] hover:bg-[#EEF2FF]/30",
    templateBasic: "hover:border-[#059669] hover:bg-[#D1FAE5]/30",
    templateEnglish: "hover:border-[#7C3AED] hover:bg-[#EDE9FE]/30",
    templateText: "hover:border-[#EA580C] hover:bg-[#FED7AA]/30",
    
    // 템플릿 카드 내부
    templateContent: "flex flex-col items-center justify-center p-6",
    
    // 확장된 콘텐츠 영역
    expandedContent: "bg-[#FAFAF9] pt-4 pb-6 px-4 border-t border-[#E8E5E0]",
  },

  // ========== 인풋 ==========
  input: {
    base: `w-full px-4 py-3 border ${colors.border} rounded-lg ${colors.cardBg} ${colors.textPrimary} focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/20 transition-all`,
    withFocus: `w-full px-4 py-3 text-lg border ${colors.border} rounded-lg focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20`,
    inline: `flex-1 px-3 py-2 border ${colors.border} rounded-lg text-sm focus:outline-none focus:border-[#6366F1]`,
    inlineScore: `w-20 px-3 py-2 border ${colors.border} rounded-lg text-sm text-right focus:outline-none focus:border-[#6366F1]`,
    setName: `text-lg font-semibold px-3 py-2 w-64 border ${colors.border} rounded-lg ${colors.cardBg} focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20`,
    checkbox: `w-5 h-5 rounded border-[#E8E5E0] accent-[#818CF8] cursor-pointer`,
  },

  // ========== 뱃지/태그 ==========
  badge: {
    gray: `text-xs px-2.5 py-1 bg-[#F7F6F3] rounded-full ${colors.textSecondary}`,
    accent: `text-sm font-medium text-[#6366F1] bg-[#EEF2FF] px-3 py-1 rounded-full`,
    blue: `text-sm font-medium text-[#6366F1] bg-[#EEF2FF] px-3 py-1 rounded-full`,
    version: `text-xs px-3 py-1 rounded-full bg-[#F7F6F3] ${colors.textSecondary}`,
    mode: `flex items-center gap-2 text-sm ${colors.textSecondary} bg-[#F7F6F3] px-3 py-1.5 rounded-full`,
    required: `text-[11px] px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#6366F1] font-medium`,
  },

  // ========== 카테고리 선택 버튼 ==========
  categoryButton: {
    base: `px-3 py-1.5 rounded-full border text-xs font-medium transition-all`,
    active: `bg-[#6366F1] border-[#6366F1] text-white`,
    inactive: `${colors.cardBg} border-[#E8E5E0] ${colors.textSecondary}`,
    interactiveHover: "hover:border-[#6366F1] hover:text-[#6366F1] cursor-pointer",
    disabled: "opacity-50 cursor-not-allowed",
    
    // 새 항목 추가용 (더 큰 버전)
    addFormBase: `flex-1 px-4 py-3 rounded-lg border text-center font-medium transition-all`,
    addFormActive: `bg-[#6366F1] border-[#6366F1] text-white shadow-sm`,
    addFormInactive: `bg-white border-[#E8E5E0] ${colors.textSecondary} hover:border-[#6366F1] hover:bg-[#EEF2FF]`,
  },

  // ========== 옵션 행 (DnD) ==========
  optionRow: `flex items-center gap-3 p-3 ${colors.cardBg} border ${colors.border} rounded-lg hover:border-[#D4D1CC] hover:shadow-sm transition-all`,
  
  // ========== 레이아웃 ==========
  layout: {
    page: `max-w-5xl mx-auto p-6 ${colors.pageBg} min-h-screen`,
    header: "flex items-center justify-between mb-6",
    buttonGroup: "flex items-center gap-3 mb-6",
    editModeRow: "mb-4 flex items-center justify-between gap-4",
    editModeInfo: `flex-1 text-sm px-4 py-3 rounded-lg border border-[#EEF2FF] bg-[#EEF2FF]/50 text-[#6366F1] flex items-center gap-2`,
    cardHeader: "cursor-pointer py-4 px-2",
    cardHeaderInner: "flex items-center justify-between",
    cardHeaderLeft: "flex items-center gap-3",
    cardHeaderRight: "flex items-center gap-1",
    optionList: "space-y-2 mb-4",
    optionAddRow: "flex gap-2",
    categoryRow: "flex flex-col gap-2 mb-4",
    categoryButtons: "flex items-center gap-2",
    categoryRowBoxOn: `rounded-lg p-3 bg-[#EEF2FF]/30 border border-[#6366F1]/30`,
    categoryRowBoxOff: `rounded-lg p-3 bg-[#F7F6F3] border border-dashed border-[#E8E5E0]`,
    setList: "space-y-4",
    editModeLeft: "flex items-center gap-3",
    templateGrid: "grid grid-cols-2 md:grid-cols-4 gap-4",
    modalActionRow: "mt-6 flex gap-3 justify-end",
    modalTitleRow: "flex items-center gap-2",
    scoringGrid: "grid grid-cols-1 md:grid-cols-3 gap-4",
    inputSection: "mt-4",
    headerRow: "flex items-center gap-3",
    editModeHint: `mt-3 flex items-center gap-2 text-sm ${colors.textSecondary}`,
    presetLabel: `mt-2 mb-2 text-xs ${colors.textSecondary}`,
  },

  // ========== AI 리포트 영역 섹션 ==========
  aiReportSection: {
    container: `mt-4 rounded-lg border border-[#6366F1]/30 bg-[#EEF2FF]/20 p-4`,
    header: "flex items-center justify-between mb-2",
    title: `text-sm font-semibold ${colors.textPrimary}`,
    description: `text-xs ${colors.textSecondary} mb-3`,
    buttonRow: "flex gap-3 text-sm",
    hint: `mt-2 text-xs ${colors.textSecondary}`,
    definitions: `mt-3 space-y-1 text-xs ${colors.textSecondary}`,
  },

  // ========== 텍스트 ==========
  text: {
    pageTitle: `text-3xl font-bold ${colors.textPrimary}`,
    sectionTitle: `font-semibold text-base ${colors.textPrimary}`,
    sectionTitleInactive: `font-semibold text-base ${colors.textMuted} line-through`,
    templateLabel: `font-semibold ${colors.textPrimary}`,
    templateSub: `text-xs ${colors.textSecondary}`,
    emptyState: `text-center ${colors.textSecondary} py-6`,
    modeLabel: `text-sm font-normal ${colors.textSecondary} ml-2`,
    editModeLabel: `text-sm font-medium ${colors.textPrimary}`,
    categoryHint: `text-xs ${colors.textSecondary} flex items-center gap-1`,
    templateCardTitle: `font-semibold ${colors.textPrimary}`,
    templateCardDesc: `text-xs ${colors.textSecondary} mt-1`,
    modalDescription: `text-sm ${colors.textSecondary} mt-2`,
    required: "text-red-500 text-xs",
    definitionLabel: `font-medium ${colors.textPrimary}`,
  },

  // ========== 아이콘 ==========
  icon: {
    chevron: `${colors.textMuted}`,
    drag: `w-5 h-5 text-[#9CA3AF]`,
    templateAccent: "w-8 h-8 mb-2 text-[#6366F1]",
    templateGreen: "w-8 h-8 mb-2 text-[#059669]",
    templatePurple: "w-8 h-8 mb-2 text-[#7C3AED]",
    templateOrange: "w-8 h-8 mb-2 text-[#EA580C]",
    info: "w-4 h-4",
    infoAccent: "w-5 h-5 text-[#6366F1]",
    infoGray: `w-5 h-5 ${colors.textSecondary}`,
    small: "w-4 h-4",
    medium: "w-5 h-5",
    buttonIcon: "w-5 h-5",
    buttonIconSmall: "w-4 h-4",
    chevronSmall: "ml-1 h-4 w-4",
  },
} as const;

// 헬퍼 함수: 조건부 클래스 조합
export const cn = (...classes: (string | boolean | undefined | null)[]) => {
  return classes.filter(Boolean).join(" ");
};