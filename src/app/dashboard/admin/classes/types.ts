// ============================================================================
// 반 관리 관련 타입 정의
// ============================================================================

/** 반 정보 */
export type Class = {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** 반 스케줄 정보 */
export type ClassSchedule = {
  id: string;
  dayOfWeek: number;  // 0=일, 1=월, ..., 6=토
  startTime: string;  // "14:00"
  endTime: string;    // "15:30"
};

/** 반 생성/수정 폼 데이터 */
export type ClassFormData = {
  name: string;
  color: string;
};

/** 반-교사 배정 정보 */
export type ClassTeacher = {
  id: string;
  tenant_id: string;
  class_id: string;
  teacher_id: string;
  role: 'primary' | 'assistant';
  is_active: boolean;
  assigned_at: string;
  unassigned_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // 조인된 정보
  teacher?: {
    id: string;
    name: string;
    display_name: string;
  };
};

/** 반-학생 등록 정보 */
export type ClassMember = {
  id: string;
  tenant_id: string;
  class_id: string;
  student_id: string;
  is_active: boolean;
  enrolled_at: string;
  deleted_at: string | null;
  updated_at: string;
  // 조인된 정보
  student?: {
    id: string;
    name: string;
    display_code: string;
  };
};

/** 반 상세 정보 (교사/학생 포함) */
export type ClassWithDetails = Class & {
  teachers: ClassTeacher[];
  members: ClassMember[];
  studentCount: number;
  teacherCount: number;
};

/** 교사 정보 (배정용) */
export type Teacher = {
  id: string;
  name: string;
  display_name: string;
};

/** 학생 정보 (배정용) */
export type Student = {
  id: string;
  name: string;
  display_code: string;
};

/** Server Action 결과 타입 */
export type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; message: string };
