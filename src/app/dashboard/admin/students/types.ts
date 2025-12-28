// ============================================================================
// 학생 관리 관련 타입 정의
// ============================================================================

/** 학생 정보 */
export type Student = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;           // 보호자 연락처 (기존 필드, 호환성 유지)
  parent_phone: string | null;    // 보호자 연락처 (새 필드)
  student_phone: string | null;   // 학생 연락처
  display_code: string;
  school: string | null;
  grade: number | null;
  address: string | null;         // 주소
  memo: string | null;            // 학생 특이사항
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** 학생 생성/수정 폼 데이터 */
export type StudentFormData = {
  name: string;
  phone?: string;                 // 보호자 연락처 (기존 필드, 호환성)
  parent_phone?: string;          // 보호자 연락처
  student_phone?: string;         // 학생 연락처
  display_code: string;
  school?: string;
  grade?: number | null;
  address?: string;               // 주소
  memo?: string;                  // 학생 특이사항
};

/** 학생의 수강 반 정보 (간단) */
export type StudentClassInfo = {
  class_id: string;
  class_name: string;
  class_color: string;
};

/** 학생 + 수강 반 목록 (카드 표시용) */
export type StudentWithClasses = Student & {
  classes: StudentClassInfo[];
};

/** 학생 수강 정보 (class_members) */
export type StudentEnrollment = {
  id: string;
  class_id: string;
  class_name: string;
  class_color: string;
  enrolled_at: string;
  is_active: boolean;
};

/** 학생 상세 정보 (수강 반 포함) */
export type StudentWithDetails = Student & {
  enrollments: StudentEnrollment[];
  currentClassCount: number;
};

/** 반 정보 (등록용) */
export type ClassInfo = {
  id: string;
  name: string;
  color: string;
};

/** 학년 옵션 */
export const GRADE_OPTIONS = [
  { value: 1, label: '초1' },
  { value: 2, label: '초2' },
  { value: 3, label: '초3' },
  { value: 4, label: '초4' },
  { value: 5, label: '초5' },
  { value: 6, label: '초6' },
  { value: 7, label: '중1' },
  { value: 8, label: '중2' },
  { value: 9, label: '중3' },
  { value: 10, label: '고1' },
  { value: 11, label: '고2' },
  { value: 12, label: '고3' },
] as const;

/** 학년 숫자 → 텍스트 변환 */
export function gradeToText(grade: number | null): string {
  if (grade === null) return '-';
  const option = GRADE_OPTIONS.find(o => o.value === grade);
  return option?.label ?? `${grade}학년`;
}

/** Server Action 결과 타입 */
export type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; message: string };
