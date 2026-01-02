// ============================================================================
// 피드 입력 관련 타입 정의
// ============================================================================

// 출결 상태
export type AttendanceStatus = 'present' | 'late' | 'absent';

// 결석 사유
export type AbsenceReason = '병결' | '학교행사' | '가사' | '무단' | '기타';

// 카드 상태
export type CardStatus = 'empty' | 'error' | 'dirty' | 'saved';

// 반 정보
export interface ClassInfo {
  id: string;
  name: string;
  color?: string | null;
}

// 학생 정보
export interface ClassStudent {
  id: string;
  name: string;
  display_code: string;
  class_id: string;
  is_makeup?: boolean;
}

// 피드 옵션
export interface FeedOption {
  id: string;
  set_id: string | null;
  label: string;
  score: number | null;
  display_order: number | null;
}

// 피드 옵션 세트
export interface FeedOptionSet {
  id: string;
  name: string;
  set_key: string;
  is_scored: boolean;
  is_required: boolean;
  options: FeedOption[];
}

// 🆕 시험 타입 (feed_option_sets에서 type='exam_score')
export interface ExamType {
  id: string;
  name: string;
  set_key: string;
}

// 메모 필드
export interface MemoField {
  id: string;
  name: string;
  isFixed: boolean;
}

// 교재 사용 기록
export interface MaterialUsage {
  id?: string;
  materialName: string;
  quantity: number;
}

// 🆕 시험 점수 값
export interface ExamScoreValue {
  setId: string;
  score: number | null;
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
  memoValues: Record<string, string>;
  feedValues: {
    setId: string;
    optionId: string;
    score?: number | null;
  }[];
  // 🆕 시험 점수
  examScores?: ExamScoreValue[];
}

// 학생 카드 데이터 (로컬 상태)
export interface StudentCardData {
  studentId: string;
  studentName: string;
  isMakeup: boolean;
  
  // 출결
  attendanceStatus: AttendanceStatus;
  absenceReason?: AbsenceReason;
  absenceReasonDetail?: string;
  notifyParent: boolean;
  needsMakeup?: boolean;
  
  // 진도
  progressText?: string;
  previousProgress?: string;
  
  // 피드 항목별 값
  feedValues: Record<string, string | null>;
  
  // 🆕 시험 점수 (setId → score)
  examScores: Record<string, number | null>;
  
  // 메모 (필드별)
  memoValues: Record<string, string>;
  
  // 교재 사용
  materials: MaterialUsage[];
  
  // 상태
  status: CardStatus;
  isDirty: boolean;
  
  // 저장된 원본 (비교용)
  savedData?: SavedFeedData;
  
  // 보강 티켓 ID (보강 수업일 때)
  makeupTicketId?: string;
}

// 세션 타입
export type SessionType = 'regular' | 'makeup';

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
  needsMakeup?: boolean;
  
  // 세션 타입 (regular: 정규수업, makeup: 보강)
  sessionType: SessionType;
  makeupTicketId?: string;  // 보강 시 연결할 티켓 ID
  
  progressText?: string;
  memoValues?: Record<string, string>;
  
  feedValues: {
    setId: string;
    optionId: string;
    score?: number | null;
  }[];
  
  // 🆕 시험 점수
  examScores?: ExamScoreValue[];
  
  idempotencyKey: string;
}

// 저장 응답
export interface SaveFeedResponse {
  success: boolean;
  feedId?: string;
  error?: string;
}

// 테넌트 설정
// 요금제 타입
export type PlanType = 'basic' | 'premium' | 'enterprise';
// 운영 모드 타입
export type OperationMode = 'solo' | 'team';  // 담임형 / 분업형

export interface TenantSettings {
  progress_enabled: boolean;
  materials_enabled: boolean;
  exam_score_enabled: boolean;  // 🆕 시험 점수 활성화
  makeup_defaults?: Record<string, boolean>;
  plan: PlanType;
  features: string[];  // 활성화된 기능 목록
  operation_mode: OperationMode;  // 운영 모드
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
