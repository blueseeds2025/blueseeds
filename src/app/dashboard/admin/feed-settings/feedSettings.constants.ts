import type { FeedTemplate, FeedTemplateKey, ReportCategory, TemplateType } from '@/types/feed-settings';

// ============================================================================
// UI Constants
// ============================================================================

export const DRAG_ACTIVATION_DISTANCE = 6 as const;
export const MAX_RETRY_ATTEMPTS = 3 as const;

export const SCORE_STEP = {
  PRECISE: 5,
  GENERAL: 10,
} as const;

// ============================================================================
// Labels
// ============================================================================

// AI 리포트 카테고리 (고정 목록)
export const REPORT_CATEGORIES = ['study', 'attitude', 'attendance', 'none'] as const;

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  study: '학습',
  attitude: '태도',
  attendance: '출결',
  none: '없음',
};

export const TEMPLATE_TYPE_LABEL: Record<Exclude<TemplateType, null>, string> = {
  text: '문장형',
  precise: '5점 단위',
  general: '10점 단위',
};

// ============================================================================
// Toast Messages
// ============================================================================

export const TOAST_MESSAGES = {
  // 성공
  TEMPLATE_APPLIED: '템플릿이 적용되었습니다',
  CATEGORY_CHANGED: 'AI 리포트 영역이 변경되었습니다',
  ITEM_ADDED: (name: string) => `'${name}' 평가항목이 추가되었습니다`,
  ITEM_DELETED: (name: string) => `"${name}" 평가항목이 삭제되었습니다`,
  ITEM_DUPLICATED: (name: string) => `"${name}" 평가항목이 복제되었습니다`,
  OPTION_ADDED: (label: string) => `"${label}" 추가됨`,
  OPTION_ADDED_NO_SCORE: (label: string) => `"${label}" 추가됨 (점수 제외)`,
  SCORE_AUTO_CORRECTED: (from: number, to: number) => `${from} → ${to}점 자동 보정`,
  TEMPLATE_SELECTED: (type: string) => `${type} 템플릿이 선택되었습니다`,

  // 에러
  ERR_LOAD_CONFIG: '설정을 불러오는데 실패했습니다',
  ERR_LOAD_ITEMS: '평가항목을 불러오는데 실패했습니다',
  ERR_LOAD_DATA: '데이터 로딩 중 오류가 발생했습니다',
  ERR_NO_CONFIG: '설정을 찾을 수 없습니다',
  ERR_NO_NAME: '이름을 입력하세요',
  ERR_NO_ITEM_NAME: '평가항목명을 입력하세요.',
  ERR_NO_CATEGORY: 'AI 리포트 영역을 먼저 선택해주세요',
  ERR_DUPLICATE_NAME: '추가 실패: 이름 중복이 계속 발생했습니다',
} as const;

// ============================================================================
// Templates
// ============================================================================

export const FEED_TEMPLATES: Record<FeedTemplateKey, FeedTemplate> = {
  custom: {
    name: '🛠️ 직접 만들기',
    description: '빈 화면에서 시작',
  },

  basic: {
    name: '📘 기본형 (10점)',
    description: '종합학원용',
    data: [
      {
        name: '숙제',
        set_key: 'homework',
        is_scored: true,
        score_step: SCORE_STEP.GENERAL,
        report_category: 'study',
        options: [
          { label: '완료', score: 100 },
          { label: '보통', score: 80 },
          { label: '미흡', score: 50 },
          { label: '안해옴', score: 0 },
        ],
      },
      {
        name: '태도',
        set_key: 'attitude',
        is_scored: true,
        score_step: SCORE_STEP.GENERAL,
        report_category: 'attitude',
        options: [
          { label: '적극적', score: 100 },
          { label: '보통', score: 70 },
          { label: '산만', score: 40 },
        ],
      },
    ],
  },

  english: {
    name: '🅰️ 영어형 (5점)',
    description: '어학원용',
    data: [
      {
        name: '단어시험',
        set_key: 'vocabulary',
        is_scored: true,
        score_step: SCORE_STEP.PRECISE,
        report_category: 'study',
        options: [
          { label: 'Pass', score: 100 },
          { label: '-1~2개', score: 90 },
          { label: '재시험', score: 50 },
        ],
      },
      {
        name: '발음',
        set_key: 'pronunciation',
        is_scored: true,
        score_step: SCORE_STEP.PRECISE,
        report_category: 'study',
        options: [
          { label: '원어민 수준', score: 100 },
          { label: '우수', score: 85 },
          { label: '개선필요', score: 70 },
        ],
      },
    ],
  },

  text: {
    name: '📝 문장형',
    description: '점수 없음',
    data: [
      {
        name: '출석',
        set_key: 'attendance',
        is_scored: false,
        score_step: null,
        report_category: 'attendance',
        options: [
          { label: '등원', score: null },
          { label: '지각', score: null },
          { label: '결석', score: null },
        ],
      },
      {
        name: '특이사항',
        set_key: 'notes',
        is_scored: false,
        score_step: null,
        report_category: 'none',
        options: [
          { label: '컨디션 좋음', score: null },
          { label: '피곤함', score: null },
          { label: '집중 잘함', score: null },
        ],
      },
    ],
  },
};