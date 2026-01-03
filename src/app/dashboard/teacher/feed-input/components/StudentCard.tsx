'use client';

import { useState } from 'react';
import { 
  StudentCardData, 
  FeedOptionSet,
  ExamType,
  Textbook,
  ProgressEntry,
  AttendanceStatus,
  AbsenceReason,
  TenantSettings,
  MemoField,
} from '../types';
import { CARD_STATUS_STYLES } from '../constants';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// 섹션 컴포넌트
import {
  AttendanceSection,
  ProgressSection,
  FeedItemsSection,
  MemoSection,
  ExamScoreSection,  // 🆕 추가
} from './sections';

interface StudentCardProps {
  data: StudentCardData;
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];  // 🆕 추가
  previousProgressEntries: ProgressEntry[];  // 🆕 추가
  tenantSettings: TenantSettings;
  memoFields: MemoField[];
  onOpenOptionPicker: (studentId: string, setId: string, anchorEl: HTMLElement) => void;
  onAttendanceChange: (studentId: string, status: AttendanceStatus, reason?: AbsenceReason, detail?: string) => void;
  onNotifyParentChange: (studentId: string, notify: boolean) => void;
  onNeedsMakeupChange: (studentId: string, needsMakeup: boolean) => void;
  onProgressChange: (studentId: string, progress: string) => void;
  onProgressEntriesChange: (studentId: string, entries: ProgressEntry[]) => void;  // 🆕 추가
  onApplyProgressToAll?: (studentId: string, entries: ProgressEntry[]) => void;  // 🆕 진도 반 전체 적용
  onMemoChange: (studentId: string, fieldId: string, value: string) => void;
  onExamScoreChange: (studentId: string, setId: string, score: number | null) => void;
  onSave: (studentId: string) => Promise<void>;
  onSendNotify?: (studentId: string) => Promise<void>;
  isSaving: boolean;
  isSendingNotify?: boolean;
}

export default function StudentCard({
  data,
  optionSets,
  examTypes,
  textbooks,  // 🆕 추가
  previousProgressEntries,  // 🆕 추가
  tenantSettings,
  memoFields,
  onOpenOptionPicker,
  onAttendanceChange,
  onNotifyParentChange,
  onNeedsMakeupChange,
  onProgressChange,
  onProgressEntriesChange,  // 🆕 추가
  onApplyProgressToAll,  // 🆕 진도 반 전체 적용
  onMemoChange,
  onExamScoreChange,
  onSave,
  onSendNotify,
  isSaving,
  isSendingNotify,
}: StudentCardProps) {
  const [showAbsenceConfirm, setShowAbsenceConfirm] = useState(false);
  
  const isAbsent = data.attendanceStatus === 'absent';
  const isLate = data.attendanceStatus === 'late';
  const styles = CARD_STATUS_STYLES[data.status];
  
  // ─────────────────────────────────────────────
  // 핸들러
  // ─────────────────────────────────────────────
  const handleSaveClick = () => {
    if (isAbsent) {
      setShowAbsenceConfirm(true);
    } else {
      onSave(data.studentId);
    }
  };
  
  const handleConfirmAbsenceSave = () => {
    setShowAbsenceConfirm(false);
    onSave(data.studentId);
  };
  
  // ─────────────────────────────────────────────
  // 스타일 헬퍼
  // ─────────────────────────────────────────────
  const isSaveDisabled = isSaving || data.status === 'saved' || data.status === 'empty';

  const getSaveButtonStyle = () => {
    if (isAbsent) return 'bg-[#DC2626] hover:bg-[#B91C1C] text-white';
    if (data.status === 'saved') return 'bg-[#D1FAE5] text-[#059669] font-semibold';
    if (data.status === 'error') return 'bg-[#EF4444] hover:bg-[#DC2626] text-white';
    if (data.status === 'dirty') return 'bg-[#6366F1] hover:bg-[#4F46E5] text-white';
    return 'bg-[#E5E7EB] text-[#9CA3AF]';
  };

  const getCardBg = () => {
    if (data.status === 'saved') return 'bg-[#ECFDF5]';
    if (data.status === 'error') return 'bg-[#FEF2F2]';
    if (isAbsent) return 'bg-[#FEF2F2]';
    if (isLate) return 'bg-[#FEF9E7]';
    if (data.status === 'dirty') return 'bg-[#FFFBEB]';
    return 'bg-white';
  };
  
  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────
  return (
    <>
      <div 
        className={`rounded-xl transition-all duration-200 hover:shadow-lg ${getCardBg()}`}
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
      >
        {/* ─────────────────────────────────────────── */}
        {/* 헤더 */}
        {/* ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1F2937]">{data.studentName}</span>
            {data.isMakeup && (
              <span className="px-2 py-0.5 bg-[#EDE9FE] text-[#7C3AED] text-xs rounded-full font-semibold">
                보강
              </span>
            )}
            {isLate && (
              <span className="px-2 py-0.5 bg-[#FEF3C7] text-[#B45309] text-xs rounded-full font-semibold">
                지각
              </span>
            )}
            {isAbsent && (
              <span className="px-2 py-0.5 bg-[#FEE2E2] text-[#DC2626] text-xs rounded-full font-semibold">
                결석
              </span>
            )}
          </div>
          <div className={`w-3 h-3 rounded-full ${styles.dot}`} />
        </div>
        
        {/* ─────────────────────────────────────────── */}
        {/* 바디 - 섹션 조립 */}
        {/* ─────────────────────────────────────────── */}
        <div className="p-3 space-y-3">
          {/* 출결 */}
          <AttendanceSection
            studentId={data.studentId}
            attendanceStatus={data.attendanceStatus}
            absenceReason={data.absenceReason}
            absenceReasonDetail={data.absenceReasonDetail}
            notifyParent={data.notifyParent}
            needsMakeup={data.needsMakeup}
            onAttendanceChange={onAttendanceChange}
            onNotifyParentChange={onNotifyParentChange}
            onNeedsMakeupChange={onNeedsMakeupChange}
            onSendNotify={onSendNotify}
            isSendingNotify={isSendingNotify}
          />
          
          {/* 진도 - 등원/지각일 때만 */}
          {tenantSettings.progress_enabled && !isAbsent && (
            <ProgressSection
              studentId={data.studentId}
              textbooks={textbooks}
              progressEntries={data.progressEntries}
              previousEntries={previousProgressEntries}
              onProgressChange={onProgressEntriesChange}
              onApplyToAll={onApplyProgressToAll 
                ? (entries) => onApplyProgressToAll(data.studentId, entries) 
                : undefined
              }
            />
          )}
          
          {/* 피드 항목 - 등원/지각일 때만 */}
          {!isAbsent && (
            <FeedItemsSection
              studentId={data.studentId}
              optionSets={optionSets}
              feedValues={data.feedValues}
              onOpenOptionPicker={onOpenOptionPicker}
            />
          )}
          
          {/* 🆕 시험 점수 - 등원/지각일 때만, 시험 종류가 있을 때만 */}
          {tenantSettings.exam_score_enabled && !isAbsent && examTypes && examTypes.length > 0 && (
            <ExamScoreSection
              studentId={data.studentId}
              examTypes={examTypes}
              examScores={data.examScores}
              onExamScoreChange={onExamScoreChange}
            />
          )}
          
          {/* 메모 - 등원/지각일 때만 */}
          {!isAbsent && (
            <MemoSection
              studentId={data.studentId}
              memoFields={memoFields}
              memoValues={data.memoValues}
              onMemoChange={onMemoChange}
            />
          )}
        </div>
        
        {/* ─────────────────────────────────────────── */}
        {/* 저장 버튼 */}
        {/* ─────────────────────────────────────────── */}
        <div className="px-3 pb-3">
          <button
            onClick={handleSaveClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSaveDisabled) {
                e.preventDefault();
                handleSaveClick();
              }
            }}
            disabled={isSaveDisabled}
            className={`
              w-full py-2.5 rounded-lg text-sm font-semibold transition-all
              focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-1
              ${getSaveButtonStyle()}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isSaving ? '저장 중...' : data.status === 'saved' ? '✓ 저장됨' : isAbsent ? '결석 저장' : '저장'}
          </button>
        </div>
      </div>
      
      {/* ─────────────────────────────────────────── */}
      {/* 결석 확인 다이얼로그 */}
      {/* ─────────────────────────────────────────── */}
      <AlertDialog open={showAbsenceConfirm} onOpenChange={setShowAbsenceConfirm}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1F2937]">결석으로 저장</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              {data.studentName} 학생을 결석으로 저장할까요?
              <br />
              <span className="text-[#DC2626] font-medium">다른 항목은 저장되지 않습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAbsenceSave}
              className="rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white"
            >
              결석 저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
