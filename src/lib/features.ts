// ============================================================================
// 기능 플래그 (Feature Flags) 상수 및 헬퍼
// ============================================================================

// 기능 키 상수
export const FEATURES = {
  // 기본 (Basic)
  FEED_INPUT: 'feed_input',
  NOTICE_BASIC: 'notice_basic',
  SCHEDULE_BASIC: 'schedule_basic',
  WEEKLY_REPORT_BASIC: 'weekly_report_basic',
  
  // 프리미엄 (Premium)
  MAKEUP_SYSTEM: 'makeup_system',
  TEACHER_PERMISSIONS: 'teacher_permissions',
  AI_MAPPING: 'ai_mapping',
  SCHEDULE_ADVANCED: 'schedule_advanced',
  NOTICE_ADVANCED: 'notice_advanced',
  MONTHLY_REPORT: 'monthly_report',
  
  // 애드온 (Add-ons)
  SEND_PUSH: 'send_push',
  SEND_KAKAO: 'send_kakao',
  SEND_SMS: 'send_sms',
  INVENTORY: 'inventory',
  EXAM_SCORE: 'exam_score',
  BILLING: 'billing',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

// 요금제별 기본 포함 기능
export const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  basic: [
    FEATURES.FEED_INPUT,
    FEATURES.NOTICE_BASIC,
    FEATURES.SCHEDULE_BASIC,
    FEATURES.WEEKLY_REPORT_BASIC,
  ],
  premium: [
    // Basic 전부 포함
    FEATURES.FEED_INPUT,
    FEATURES.NOTICE_BASIC,
    FEATURES.SCHEDULE_BASIC,
    FEATURES.WEEKLY_REPORT_BASIC,
    // Premium 추가
    FEATURES.MAKEUP_SYSTEM,
    FEATURES.TEACHER_PERMISSIONS,
    FEATURES.AI_MAPPING,
    FEATURES.SCHEDULE_ADVANCED,
    FEATURES.NOTICE_ADVANCED,
    FEATURES.MONTHLY_REPORT,
  ],
  enterprise: [
    // Premium 전부 포함 + 모든 기능
    FEATURES.FEED_INPUT,
    FEATURES.NOTICE_BASIC,
    FEATURES.SCHEDULE_BASIC,
    FEATURES.WEEKLY_REPORT_BASIC,
    FEATURES.MAKEUP_SYSTEM,
    FEATURES.TEACHER_PERMISSIONS,
    FEATURES.AI_MAPPING,
    FEATURES.SCHEDULE_ADVANCED,
    FEATURES.NOTICE_ADVANCED,
    FEATURES.MONTHLY_REPORT,
    // 애드온도 기본 포함
    FEATURES.SEND_PUSH,
    FEATURES.SEND_KAKAO,
    FEATURES.SEND_SMS,
    FEATURES.INVENTORY,
    FEATURES.EXAM_SCORE,
    FEATURES.BILLING,
  ],
};

// 기능별 표시 정보
export const FEATURE_INFO: Record<FeatureKey, { name: string; description: string; tier: 'basic' | 'premium' | 'addon' }> = {
  [FEATURES.FEED_INPUT]: {
    name: '피드 입력',
    description: '학생별 출결/진도/평가 입력',
    tier: 'basic',
  },
  [FEATURES.NOTICE_BASIC]: {
    name: '공지 (기본)',
    description: '공지 작성 및 노출',
    tier: 'basic',
  },
  [FEATURES.SCHEDULE_BASIC]: {
    name: '시간표 (기본)',
    description: '월간/주간 시간표 보기',
    tier: 'basic',
  },
  [FEATURES.WEEKLY_REPORT_BASIC]: {
    name: '주간 리포트',
    description: '템플릿 기반 주간 리포트',
    tier: 'basic',
  },
  [FEATURES.MAKEUP_SYSTEM]: {
    name: '결석/보강 관리',
    description: '결석 시 보강 티켓 자동 생성 및 관리',
    tier: 'premium',
  },
  [FEATURES.TEACHER_PERMISSIONS]: {
    name: '교사별 권한',
    description: '교사별 피드 항목 접근 권한 설정',
    tier: 'premium',
  },
  [FEATURES.AI_MAPPING]: {
    name: 'AI 매핑',
    description: '피드 옵션 → 리포트 카테고리 AI 매핑',
    tier: 'premium',
  },
  [FEATURES.SCHEDULE_ADVANCED]: {
    name: '시간표 (고급)',
    description: '교사 색상, 중복 경고, 인쇄 최적화',
    tier: 'premium',
  },
  [FEATURES.NOTICE_ADVANCED]: {
    name: '공지 (고급)',
    description: '고정 공지, 만료, 확인 로그',
    tier: 'premium',
  },
  [FEATURES.MONTHLY_REPORT]: {
    name: '월말 리포트',
    description: 'AI 합성 월말 리포트',
    tier: 'premium',
  },
  [FEATURES.SEND_PUSH]: {
    name: '푸시 알림',
    description: '앱 푸시 알림 발송',
    tier: 'addon',
  },
  [FEATURES.SEND_KAKAO]: {
    name: '카카오톡 발송',
    description: '카카오톡 알림 발송',
    tier: 'addon',
  },
  [FEATURES.SEND_SMS]: {
    name: 'SMS 발송',
    description: 'SMS 문자 발송',
    tier: 'addon',
  },
  [FEATURES.INVENTORY]: {
    name: '재고 관리',
    description: '교재/재고 관리 및 검수',
    tier: 'addon',
  },
  [FEATURES.EXAM_SCORE]: {
    name: '시험/성적',
    description: '시험 정의, 입력, 집계',
    tier: 'addon',
  },
  [FEATURES.BILLING]: {
    name: '원비/납부',
    description: '원비 고지 및 납부 관리',
    tier: 'addon',
  },
};

// ============================================================================
// 클라이언트용 헬퍼 함수
// ============================================================================

/**
 * 특정 기능이 활성화되어 있는지 확인
 */
export function hasFeature(
  enabledFeatures: string[],
  featureKey: FeatureKey
): boolean {
  return enabledFeatures.includes(featureKey);
}

/**
 * 여러 기능 중 하나라도 있는지 확인
 */
export function hasAnyFeature(
  enabledFeatures: string[],
  featureKeys: FeatureKey[]
): boolean {
  return featureKeys.some(key => enabledFeatures.includes(key));
}

/**
 * 모든 기능이 있는지 확인
 */
export function hasAllFeatures(
  enabledFeatures: string[],
  featureKeys: FeatureKey[]
): boolean {
  return featureKeys.every(key => enabledFeatures.includes(key));
}

/**
 * 기능의 표시 정보 가져오기
 */
export function getFeatureInfo(featureKey: FeatureKey) {
  return FEATURE_INFO[featureKey];
}

/**
 * 요금제에 포함된 기능 목록 가져오기
 */
export function getPlanFeatures(plan: string): FeatureKey[] {
  return PLAN_FEATURES[plan] || PLAN_FEATURES.basic;
}
