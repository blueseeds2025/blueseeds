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
// 카테고리 (월간 리포트 섹션 매핑용)
// ============================================================================

export const REPORT_CATEGORIES = ['ATTITUDE', 'HOMEWORK', 'EVALUATION', 'PROGRESS', 'EXCLUDED'] as const;

export const REPORT_CATEGORY_LABEL: Partial<Record<ReportCategory, string>> = {
  ATTITUDE: '태도',
  HOMEWORK: '과제',
  EVALUATION: '평가',
  PROGRESS: '진도',
  EXCLUDED: '리포트 제외',
};

export const REPORT_CATEGORY_DESCRIPTION: Partial<Record<ReportCategory, string>> = {
  ATTITUDE: '학습 태도, 집중도, 참여도, 자세',
  HOMEWORK: '숙제, 과제, 연습량',
  EVALUATION: '이해도, 실력, 오답률, 선생님 평가',
  PROGRESS: '학습 진행, 단계, 커리큘럼',
  EXCLUDED: '내부 관리용 (리포트에 미포함)',
};

// ============================================================================
// Labels
// ============================================================================

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
  CATEGORY_CHANGED: '카테고리가 변경되었습니다',
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
  ERR_NO_CATEGORY: '카테고리를 먼저 선택해주세요',
  ERR_DUPLICATE_NAME: '추가 실패: 이름 중복이 계속 발생했습니다',
} as const;

// ============================================================================
// Templates (카테고리 새 값으로 업데이트)
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
        report_category: 'HOMEWORK',
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
        report_category: 'ATTITUDE',
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
        report_category: 'EVALUATION',
        options: [
          { label: 'Pass', score: 100 },
          { label: '-1~2개', score: 90 },
          { label: '재시험', score: 50 },
        ],
      },
      {
        name: '이해도',
        set_key: 'comprehension',
        is_scored: true,
        score_step: SCORE_STEP.PRECISE,
        report_category: 'EVALUATION',
        options: [
          { label: '완벽히 이해', score: 100 },
          { label: '대체로 이해', score: 85 },
          { label: '복습 필요', score: 70 },
        ],
      },
    ],
  },

  text: {
    name: '📝 문장형',
    description: '점수 없음',
    data: [
      {
        name: '진도',
        set_key: 'progress',
        is_scored: false,
        score_step: null,
        report_category: 'PROGRESS',
        options: [
          { label: '예정대로 진행', score: null },
          { label: '빠른 진행', score: null },
          { label: '복습 중', score: null },
        ],
      },
      {
        name: '특이사항',
        set_key: 'notes',
        is_scored: false,
        score_step: null,
        report_category: 'EXCLUDED',
        options: [
          { label: '컨디션 좋음', score: null },
          { label: '피곤함', score: null },
          { label: '집중 잘함', score: null },
        ],
      },
    ],
  },
};
