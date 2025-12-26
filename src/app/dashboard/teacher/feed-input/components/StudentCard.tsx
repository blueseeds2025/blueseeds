'use client';

import { useState } from 'react';
import { 
  StudentCardData, 
  FeedOptionSet, 
  CardStatus,
  AttendanceStatus,
  AbsenceReason,
  TenantSettings 
} from '../types';
import { 
  CARD_STATUS_STYLES, 
  ABSENCE_REASONS,
  TOAST_MESSAGES 
} from '../constants';
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

interface StudentCardProps {
  data: StudentCardData;
  optionSets: FeedOptionSet[];
  tenantSettings: TenantSettings;
  onOpenBottomSheet: (studentId: string, setId: string) => void;
  onAttendanceChange: (studentId: string, status: AttendanceStatus, reason?: AbsenceReason, detail?: string) => void;
  onNotifyParentChange: (studentId: string, notify: boolean) => void;
  onProgressChange: (studentId: string, progress: string) => void;
  onMemoChange: (studentId: string, memo: string) => void;
  onSave: (studentId: string) => Promise<void>;
  isSaving: boolean;
}

export default function StudentCard({
  data,
  optionSets,
  tenantSettings,
  onOpenBottomSheet,
  onAttendanceChange,
  onNotifyParentChange,
  onProgressChange,
  onMemoChange,
  onSave,
  isSaving,
}: StudentCardProps) {
  const [showAbsenceConfirm, setShowAbsenceConfirm] = useState(false);
  const [showReasonDetail, setShowReasonDetail] = useState(false);
  const [reasonDetail, setReasonDetail] = useState(data.absenceReasonDetail || '');
  
  const isAbsent = data.attendanceStatus === 'absent';
  const styles = CARD_STATUS_STYLES[data.status];
  
  // 결석 저장 확인 핸들러
  const handleSaveClick = () => {
    if (isAbsent) {
      setShowAbsenceConfirm(true);
    } else {
      onSave(data.studentId);
    }
  };
  
  // 결석 확정 후 저장
  const handleConfirmAbsenceSave = () => {
    setShowAbsenceConfirm(false);
    onSave(data.studentId);
  };
  
  // 출결 변경 핸들러
  const handleAttendanceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === 'present') {
      onAttendanceChange(data.studentId, 'present');
    } else {
      // 결석 사유 선택
      const reason = value as AbsenceReason;
      const autoNotify = ABSENCE_REASONS.find(r => r.value === reason)?.autoNotify || false;
      
      if (reason === '기타') {
        setShowReasonDetail(true);
      }
      
      onAttendanceChange(data.studentId, 'absent', reason);
      
      // 무단/지각은 자동 알림 ON
      if (autoNotify) {
        onNotifyParentChange(data.studentId, true);
      }
    }
  };
  
  // 옵션 라벨 가져오기
  const getOptionLabel = (setId: string): string => {
    const optionId = data.feedValues[setId];
    if (!optionId) return '선택';
    
    const set = optionSets.find(s => s.id === setId);
    const option = set?.options.find(o => o.id === optionId);
    return option?.label || '선택';
  };
  
  // 저장 버튼 텍스트
  const saveButtonText = isAbsent ? '결석 저장' : '저장';
  
  return (
    <>
      <div 
        className={`
          rounded-lg border-2 p-4 transition-all
          ${styles.border} ${styles.bg}
          ${isAbsent ? 'opacity-80' : ''}
        `}
      >
        {/* 헤더: 학생 이름 + 상태 뱃지 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{data.studentName}</span>
            {data.isMakeup && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                보강
              </span>
            )}
            {isAbsent && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                결석
              </span>
            )}
          </div>
          <span className="text-lg">{styles.badge}</span>
        </div>
        
        {/* 출결 선택 */}
        <div className="mb-3">
          <label className="block text-sm text-gray-600 mb-1">출결</label>
          <select
            value={isAbsent ? data.absenceReason || '' : 'present'}
            onChange={handleAttendanceChange}
            className={`
              w-full px-3 py-2 border rounded-lg text-sm
              ${isAbsent ? 'border-red-300 bg-red-50' : 'border-gray-300'}
            `}
          >
            <option value="present">✅ 출석</option>
            <optgroup label="결석 사유">
              {ABSENCE_REASONS.map(reason => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </optgroup>
          </select>
          
          {/* 기타 사유 입력 */}
          {isAbsent && data.absenceReason === '기타' && (
            <input
              type="text"
              placeholder="결석 사유 입력"
              value={reasonDetail}
              onChange={(e) => {
                setReasonDetail(e.target.value);
                onAttendanceChange(data.studentId, 'absent', '기타', e.target.value);
              }}
              className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          )}
          
          {/* 학부모 알림 체크 */}
          {isAbsent && (
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={data.notifyParent}
                onChange={(e) => onNotifyParentChange(data.studentId, e.target.checked)}
                className="rounded"
              />
              <span>학부모 알림</span>
              {(data.absenceReason === '무단' || data.absenceReason === '지각') && (
                <span className="text-xs text-red-500">(자동 ON)</span>
              )}
            </label>
          )}
        </div>
        
        {/* 진도 (ON일 때만) */}
        {tenantSettings.progress_enabled && (
          <div className={`mb-3 ${isAbsent ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-sm text-gray-600 mb-1">
              진도
              {data.previousProgress && (
                <span className="text-xs text-gray-400 ml-2">
                  (이전: {data.previousProgress})
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder={data.previousProgress || '진도 입력'}
              value={data.progressText || ''}
              onChange={(e) => onProgressChange(data.studentId, e.target.value)}
              disabled={isAbsent}
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
            />
          </div>
        )}
        
        {/* 피드 항목들 */}
        <div className={`space-y-2 mb-3 ${isAbsent ? 'opacity-50 pointer-events-none' : ''}`}>
          {optionSets.map(set => {
            const currentValue = data.feedValues[set.id];
            const isEmpty = !currentValue;
            const isRequired = set.is_required;
            
            return (
              <div key={set.id}>
                <label className="block text-sm text-gray-600 mb-1">
                  {set.name}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <button
                  onClick={() => !isAbsent && onOpenBottomSheet(data.studentId, set.id)}
                  disabled={isAbsent}
                  className={`
                    w-full px-3 py-2 border rounded-lg text-sm text-left
                    transition-colors
                    ${isEmpty && isRequired && !isAbsent
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 hover:border-indigo-400'
                    }
                    disabled:bg-gray-100 disabled:cursor-not-allowed
                  `}
                >
                  {getOptionLabel(set.id)}
                </button>
              </div>
            );
          })}
        </div>
        
        {/* 메모 */}
        <div className={`mb-4 ${isAbsent ? 'opacity-50' : ''}`}>
          <label className="block text-sm text-gray-600 mb-1">메모 (내부용)</label>
          <textarea
            placeholder="메모 입력"
            value={data.memos[0] || ''}
            onChange={(e) => onMemoChange(data.studentId, e.target.value)}
            disabled={isAbsent}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none disabled:bg-gray-100"
          />
        </div>
        
        {/* 저장 버튼 */}
        <button
          onClick={handleSaveClick}
          disabled={isSaving || data.status === 'saved'}
          className={`
            w-full py-2 rounded-lg font-medium transition-colors
            ${isAbsent
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : data.status === 'saved'
                ? 'bg-green-100 text-green-700 cursor-default'
                : 'bg-indigo-500 hover:bg-indigo-600 text-white'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isSaving ? '저장 중...' : data.status === 'saved' ? '✓ 저장됨' : saveButtonText}
        </button>
      </div>
      
      {/* 결석 저장 확인 다이얼로그 */}
      <AlertDialog open={showAbsenceConfirm} onOpenChange={setShowAbsenceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>결석으로 저장</AlertDialogTitle>
            <AlertDialogDescription>
              {data.studentName} 학생을 결석으로 저장할까요?
              <br />
              <span className="text-red-500 font-medium">
                다른 항목은 저장되지 않습니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAbsenceSave}
              className="bg-red-500 hover:bg-red-600"
            >
              결석 저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
