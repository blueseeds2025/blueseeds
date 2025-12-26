// ============================================================================
// 교사 피드 입력 타입 정의
// ============================================================================

// 학생 정보
export interface Student {
  id: string;
  name: string;
  display_code: string;
}

// 반 정보
export interface ClassInfo {
  id: string;
  name: string;
  color: string;
}

// 반에 속한 학생
export interface ClassStudent extends Student {
  class_id: string;
  is_makeup?: boolean;  // 보강생 여부
}

// 피드 옵션 세트 (숙제, 태도 등)
export interface FeedOptionSet {
  id: string;
  name: string;
  set_key: string;
  is_scored: boolean;
  is_required: boolean;
  options: FeedOption[];
}

// 피드 옵션 (완료, 미흡, 미제출 등)
export interface FeedOption {
  id: string;
  set_id: string;
  label: string;
  score: number | null;
  display_order: number;
}

// 출결 상태
export type AttendanceStatus = 'present' | 'absent';

// 결석 사유
export type AbsenceReason = 
  | '병결' 
  | '가사' 
  | '학교행사' 
  | '무단' 
  | '지각' 
  | '기타';

// 카드 저장 상태
export type CardStatus = 
  | 'empty'    // 아무것도 입력 안 됨
  | 'error'    // 🔴 필수값 누락
  | 'dirty'    // 🟡 변경됨 (미저장)
  | 'saved';   // 🟢 저장 완료

// 학생 카드 데이터 (로컬 상태)
export interface StudentCardData {
  studentId: string;
  studentName: string;
  isMakeup: boolean;
  
  // 출결
  attendanceStatus: AttendanceStatus;
  absenceReason?: AbsenceReason;
  absenceReasonDetail?: string;  // 기타 선택 시
  notifyParent: boolean;
  
  // 진도 (ON/OFF 가능)
  progressText?: string;
  previousProgress?: string;  // placeholder용 이전 진도
  
  // 피드 항목별 값
  feedValues: Record<string, string | null>;  // set_id → option_id
  
  // 메모
  memos: string[];
  
  // 교재 사용 (ON/OFF 가능)
  materials: MaterialUsage[];
  
  // 상태
  status: CardStatus;
  isDirty: boolean;
  
  // 저장된 원본 (비교용)
  savedData?: SavedFeedData;
}

// 교재 사용 기록
export interface MaterialUsage {
  id?: string;
  materialName: string;
  quantity: number;
}

// DB에 저장된 피드 데이터
export interface SavedFeedData {
  id: string;
  attendanceStatus: AttendanceStatus;
  absenceReason?: string;
  absenceReasonDetail?: string;
  notifyParent: boolean;
  isMakeup: boolean;
  progressText?: string;
  memo?: string;
  feedValues: {
    setId: string;
    optionId: string;
    score?: number;
  }[];
  materials: {
    id: string;
    materialName: string;
    quantity: number;
  }[];
}

// 저장 요청 payload
export interface SaveFeedPayload {
  studentId: string;
  classId: string;
  feedDate: string;  // YYYY-MM-DD
  
  attendanceStatus: AttendanceStatus;
  absenceReason?: string;
  absenceReasonDetail?: string;
  notifyParent: boolean;
  isMakeup: boolean;
  
  progressText?: string;
  memo?: string;
  
  feedValues: {
    setId: string;
    optionId: string;
  }[];
  
  materials: {
    materialName: string;
    quantity: number;
  }[];
  
  idempotencyKey: string;
}

// 저장 응답
export interface SaveFeedResponse {
  success: boolean;
  feedId?: string;
  error?: string;
}

// 테넌트 설정
export interface TenantSettings {
  progress_enabled: boolean;
  materials_enabled: boolean;
}

// 바텀시트 상태
export interface BottomSheetState {
  isOpen: boolean;
  studentId: string | null;
  setId: string | null;
  setName: string | null;
  options: FeedOption[];
  currentValue: string | null;
}
