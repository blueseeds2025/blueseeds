'use client';

import { useState } from 'react';
import { 
  StudentCardData, 
  FeedOptionSet, 
  AttendanceStatus,
  AbsenceReason,
  TenantSettings,
  MemoField,
} from '../types';
import { 
  CARD_STATUS_STYLES, 
  ABSENCE_REASONS,
  ATTENDANCE_OPTIONS,
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
  memoFields: MemoField[];
  onOpenOptionPicker: (studentId: string, setId: string, anchorEl: HTMLElement) => void;
  onAttendanceChange: (studentId: string, status: AttendanceStatus, reason?: AbsenceReason, detail?: string) => void;
  onNotifyParentChange: (studentId: string, notify: boolean) => void;
  onNeedsMakeupChange: (studentId: string, needsMakeup: boolean) => void;
  onProgressChange: (studentId: string, progress: string) => void;
  onMemoChange: (studentId: string, fieldId: string, value: string) => void;
  onSave: (studentId: string) => Promise<void>;
  onSendNotify?: (studentId: string) => Promise<void>;
  isSaving: boolean;
  isSendingNotify?: boolean;
}

export default function StudentCard({
  data,
  optionSets,
  tenantSettings,
  memoFields,
  onOpenOptionPicker,
  onAttendanceChange,
  onNotifyParentChange,
  onNeedsMakeupChange,
  onProgressChange,
  onMemoChange,
  onSave,
  onSendNotify,
  isSaving,
  isSendingNotify,
}: StudentCardProps) {
  const [showAbsenceConfirm, setShowAbsenceConfirm] = useState(false);
  const [reasonDetail, setReasonDetail] = useState(data.absenceReasonDetail || '');
  
  const isAbsent = data.attendanceStatus === 'absent';
  const isLate = data.attendanceStatus === 'late';
  const styles = CARD_STATUS_STYLES[data.status];
  
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
  
  const handleAttendanceStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as AttendanceStatus;
    onAttendanceChange(data.studentId, value);
    
    // 지각 선택 시 자동으로 학부모 알림 ON
    if (value === 'late') {
      onNotifyParentChange(data.studentId, true);
    }
  };
  
  const handleAbsenceReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const reason = e.target.value as AbsenceReason;
    const autoNotify = ABSENCE_REASONS.find(r => r.value === reason)?.autoNotify || false;
    onAttendanceChange(data.studentId, 'absent', reason);
    if (autoNotify) {
      onNotifyParentChange(data.studentId, true);
    }
  };
  
  const getOptionLabel = (setId: string): string => {
    const optionId = data.feedValues[setId];
    if (!optionId) return '선택';
    const set = optionSets.find(s => s.id === setId);
    const option = set?.options.find(o => o.id === optionId);
    return option?.label || '선택';
  };
  
  const isSaveDisabled = isSaving || data.status === 'saved' || data.status === 'empty';

  const getSaveButtonStyle = () => {
    if (isAbsent) return 'bg-[#DC2626] hover:bg-[#B91C1C] text-white';
    if (data.status === 'saved') return 'bg-[#D1FAE5] text-[#059669] font-semibold';
    if (data.status === 'error') return 'bg-[#EF4444] hover:bg-[#DC2626] text-white';
    if (data.status === 'dirty') return 'bg-[#6366F1] hover:bg-[#4F46E5] text-white';
    return 'bg-[#E5E7EB] text-[#9CA3AF]';
  };

 const getCardBg = () => {
    // 저장됨 상태가 최우선
    if (data.status === 'saved') return 'bg-[#ECFDF5]';
    if (data.status === 'error') return 'bg-[#FEF2F2]';
    
    // 출결 상태에 따른 배경
    if (isAbsent) return 'bg-[#FEF2F2]';
    if (isLate) return 'bg-[#FEF9E7]';
    if (data.status === 'dirty') return 'bg-[#FFFBEB]';
    
    return 'bg-white';
  };

  const getAttendanceSelectStyle = () => {
    if (isAbsent) return 'border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626]';
    if (isLate) return 'border-[#FCD34D] bg-[#FEF9E7] text-[#B45309]';
    return 'border-[#E5E7EB] bg-white text-[#1F2937]';
  };
  
  return (
    <>
      <div 
        className={`rounded-xl transition-all duration-200 hover:shadow-lg ${getCardBg()}`}
        style={{
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        {/* 헤더 */}
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
        
        {/* 바디 */}
        <div className="p-3 space-y-3">
          {/* 출결 */}
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1">출결</label>
            <select
              value={data.attendanceStatus}
              onChange={handleAttendanceStatusChange}
              className={`
                w-full px-3 py-2 border rounded-lg text-sm font-medium
                focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30
                ${getAttendanceSelectStyle()}
              `}
            >
              {ATTENDANCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          {/* 지각 - 학부모 알림 */}
          {isLate && (
            <div className="p-3 bg-[#FFFBEB] rounded-lg border border-[#FCD34D]">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-[#92400E]">
                  <input
                    type="checkbox"
                    checked={data.notifyParent}
                    onChange={(e) => onNotifyParentChange(data.studentId, e.target.checked)}
                    className="rounded border-[#FCD34D] text-[#F59E0B]"
                  />
                  <span className="font-medium">학부모 알림</span>
                </label>
                {data.notifyParent && onSendNotify && (
                  <button
                    onClick={() => onSendNotify(data.studentId)}
                    disabled={isSendingNotify}
                    className="px-3 py-1 bg-[#F59E0B] hover:bg-[#D97706] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSendingNotify ? '전송중...' : '보내기'}
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* 결석 사유 */}
          {isAbsent && (
            <div className="p-3 bg-white/60 rounded-lg border border-[#FECACA]">
              <label className="block text-xs font-semibold text-[#DC2626] mb-1">
                결석 사유 <span className="text-[#EF4444]">*</span>
              </label>
              <select
                value={data.absenceReason || ''}
                onChange={handleAbsenceReasonChange}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
              >
                <option value="">선택</option>
                {ABSENCE_REASONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              
              {data.absenceReason === '기타' && (
                <input
                  type="text"
                  placeholder="사유 입력"
                  value={reasonDetail}
                  onChange={(e) => {
                    setReasonDetail(e.target.value);
                    onAttendanceChange(data.studentId, 'absent', '기타', e.target.value);
                  }}
                  className="w-full mt-2 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white"
                />
              )}
              
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-xs text-[#6B7280]">
                  <input
                    type="checkbox"
                    checked={data.notifyParent}
                    onChange={(e) => onNotifyParentChange(data.studentId, e.target.checked)}
                    className="rounded border-[#D1D5DB] text-[#6366F1]"
                  />
                  <span>학부모 알림</span>
                  {data.absenceReason === '무단' && (
                    <span className="text-[#F59E0B] font-semibold">(자동)</span>
                  )}
                </label>
                {data.notifyParent && onSendNotify && (
                  <button
                    onClick={() => onSendNotify(data.studentId)}
                    disabled={isSendingNotify}
                    className="px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSendingNotify ? '전송중...' : '보내기'}
                  </button>
                )}
              </div>
              
              {/* 보강 필요 체크박스 - 사유 선택 후에만 노출 */}
              {data.absenceReason && (
                <div className="flex items-center mt-2 pt-2 border-t border-[#FECACA]">
                  <label className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <input
                      type="checkbox"
                      checked={data.needsMakeup ?? false}
                      onChange={(e) => onNeedsMakeupChange(data.studentId, e.target.checked)}
                      className="rounded border-[#D1D5DB] text-[#7C3AED]"
                    />
                    <span className="font-medium text-[#7C3AED]">보강 필요</span>
                  </label>
                </div>
              )}
            </div>
          )}
          
          {/* 진도 - 등원/지각일 때만 */}
          {tenantSettings.progress_enabled && !isAbsent && (
            <div>
              <label className="block text-xs font-semibold text-[#6B7280] mb-1">
                진도
                {data.previousProgress && (
                  <span className="text-[#9CA3AF] font-normal ml-1">(이전: {data.previousProgress})</span>
                )}
              </label>
              <input
                type="text"
                placeholder={data.previousProgress || '진도 입력'}
                value={data.progressText || ''}
                onChange={(e) => onProgressChange(data.studentId, e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
              />
            </div>
          )}
          
          {/* 피드 항목 - 등원/지각일 때만 */}
          {!isAbsent && optionSets.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {optionSets.map((set, index) => {
                const isEmpty = !data.feedValues[set.id];
                return (
                  <div key={set.id}>
                    <label className="block text-xs font-semibold text-[#6B7280] mb-1">
                      {set.name}<span className="text-[#EF4444]">*</span>
                    </label>
                    <button
                      type="button"
                      tabIndex={0}
                      onFocus={(e) => {
                        onOpenOptionPicker(data.studentId, set.id, e.currentTarget);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenOptionPicker(data.studentId, set.id, e.currentTarget);
                      }}
                      className={`
                        w-full px-3 py-2 border rounded-lg text-sm text-left font-medium
                        transition-colors hover:opacity-80
                        focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-1
                        ${isEmpty
                          ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]'
                          : 'border-[#6EE7B7] bg-[#D1FAE5] text-[#059669]'
                        }
                      `}
                    >
                      {getOptionLabel(set.id)}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 메모 - 등원/지각일 때만 */}
          {!isAbsent && memoFields.length > 0 && (
            <div className="space-y-2">
              {memoFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-1">
                    {field.name}
                  </label>
                  <input
                    type="text"
                    placeholder={`${field.name} 입력`}
                    value={data.memoValues[field.id] || ''}
                    onChange={(e) => onMemoChange(data.studentId, field.id, e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 저장 버튼 */}
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
      
      {/* 결석 확인 다이얼로그 */}
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