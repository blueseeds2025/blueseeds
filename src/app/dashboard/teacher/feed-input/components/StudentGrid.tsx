'use client';

import { memo } from 'react';
import StudentCard from './StudentCard';
import {
  StudentCardData,
  FeedOptionSet,
  ExamType,
  Textbook,
  TenantSettings,
  ProgressEntry,
  AttendanceStatus,
  AbsenceReason,
} from '../types';

interface MemoField {
  id: string;
  name: string;
}

interface StudentGridProps {
  students: { id: string; name: string }[];
  cardDataMap: Record<string, StudentCardData>;
  optionSets: FeedOptionSet[];
  examTypes: ExamType[];
  textbooks: Textbook[];
  previousProgressEntriesMap: Record<string, ProgressEntry[]>;
  tenantSettings: TenantSettings;
  memoFields: MemoField[];
  gridClass: string;
  savingStudentId: string | null;
  // ✅ 시그니처 변경: currentValue 추가
  onOpenOptionPicker: (studentId: string, setId: string, anchorEl: HTMLElement, currentValue: string | null) => void;
  onAttendanceChange: (studentId: string, status: AttendanceStatus, reason?: AbsenceReason, detail?: string) => void;
  onNotifyParentChange: (studentId: string, notify: boolean) => void;
  onNeedsMakeupChange: (studentId: string, needsMakeup: boolean) => void;
  onProgressChange: (studentId: string, text: string) => void;
  onProgressEntriesChange: (studentId: string, entries: ProgressEntry[]) => void;
  onApplyProgressToAll?: (studentId: string) => void;
  onMemoChange: (studentId: string, key: string, value: string) => void;
  onExamScoreChange: (studentId: string, setId: string, score: number | null) => void;
  onSave: (studentId: string) => void;
}

export const StudentGrid = memo(function StudentGrid({
  students,
  cardDataMap,
  optionSets,
  examTypes,
  textbooks,
  previousProgressEntriesMap,
  tenantSettings,
  memoFields,
  gridClass,
  savingStudentId,
  onOpenOptionPicker,
  onAttendanceChange,
  onNotifyParentChange,
  onNeedsMakeupChange,
  onProgressChange,
  onProgressEntriesChange,
  onApplyProgressToAll,
  onMemoChange,
  onExamScoreChange,
  onSave,
}: StudentGridProps) {
  return (
    <div className={`grid gap-3 ${gridClass}`}>
      {students.map(student => {
        const cardData = cardDataMap[student.id];
        if (!cardData) return null;
        
        return (
          <StudentCard
            key={student.id}
            data={cardData}
            optionSets={optionSets}
            examTypes={examTypes}
            textbooks={textbooks}
            previousProgressEntries={previousProgressEntriesMap[student.id] || []}
            tenantSettings={tenantSettings}
            memoFields={memoFields}
            onOpenOptionPicker={onOpenOptionPicker}
            onAttendanceChange={onAttendanceChange}
            onNotifyParentChange={onNotifyParentChange}
            onNeedsMakeupChange={onNeedsMakeupChange}
            onProgressChange={onProgressChange}
            onProgressEntriesChange={onProgressEntriesChange}
            onApplyProgressToAll={students.length > 1 ? onApplyProgressToAll : undefined}
            onMemoChange={onMemoChange}
            onExamScoreChange={onExamScoreChange}
            onSave={onSave}
            isSaving={savingStudentId === student.id}
          />
        );
      })}
    </div>
  );
});
