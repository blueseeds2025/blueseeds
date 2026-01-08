// ============================================================================
// 교사 관리 관련 타입 정의
// ============================================================================

/** 교사 정보 */
export type Teacher = {
  id: string;
  tenant_id: string;
  name: string;
  display_name: string;
  color: string;
  role: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  classCount?: number;  // ✅ 담당 반 개수 추가
};

/** 교사 상세 정보 (담당 반, 기능 권한, 피드 권한 포함) */
export type TeacherWithDetails = Teacher & {
  assignedClasses: AssignedClass[];
  permissions: TeacherPermissions;      // 기능 권한 (Basic)
  feedPermissions: FeedPermission[];    // 피드 항목 권한 (Premium)
};

/** 담당 반 정보 */
export type AssignedClass = {
  id: string;
  class_id: string;
  class_name: string;
  class_color: string;
  role: 'primary' | 'assistant';
  is_active: boolean;
};

/** 피드 항목 권한 (Premium) */
export type FeedPermission = {
  id: string | null;  // null이면 아직 설정 안 됨
  option_set_id: string;
  option_set_name: string;
  is_allowed: boolean;
};

/** 선생님 기능 권한 (Basic + Premium) */
export type TeacherPermissions = {
  id: string | null;
  // Basic
  can_view_reports: boolean;
  // Premium (나중에 추가)
  // can_customize_feed_items: boolean;
  // can_use_schedule: boolean;
  // can_use_inventory: boolean;
};

/** 피드 항목 (권한 설정용) */
export type FeedOptionSet = {
  id: string;
  name: string;
  category: string;
  is_scored: boolean;
};

/** 반 정보 (배정용) */
export type ClassInfo = {
  id: string;
  name: string;
  color: string;
};

/** Server Action 결과 타입 */
export type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false, message: string };
