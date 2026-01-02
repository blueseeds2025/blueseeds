'use client';

import { useState } from 'react';
import { 
  AttendanceStatus,
  AbsenceReason,
} from '../../types';
import { 
  ABSENCE_REASONS,
  ATTENDANCE_OPTIONS,
} from '../../constants';

interface AttendanceSectionProps {
  studentId: string;
  attendanceStatus: AttendanceStatus;
  absenceReason?: AbsenceReason;
  absenceReasonDetail?: string;
  notifyParent: boolean;
  needsMakeup?: boolean;
  onAttendanceChange: (studentId: string, status: AttendanceStatus, reason?: AbsenceReason, detail?: string) => void;
  onNotifyParentChange: (studentId: string, notify: boolean) => void;
  onNeedsMakeupChange: (studentId: string, needsMakeup: boolean) => void;
  onSendNotify?: (studentId: string) => Promise<void>;
  isSendingNotify?: boolean;
}

export default function AttendanceSection({
  studentId,
  attendanceStatus,
  absenceReason,
  absenceReasonDetail,
  notifyParent,
  needsMakeup,
  onAttendanceChange,
  onNotifyParentChange,
  onNeedsMakeupChange,
  onSendNotify,
  isSendingNotify,
}: AttendanceSectionProps) {
  const [reasonDetail, setReasonDetail] = useState(absenceReasonDetail || '');
  
  const isAbsent = attendanceStatus === 'absent';
  const isLate = attendanceStatus === 'late';

  const handleAttendanceStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as AttendanceStatus;
    onAttendanceChange(studentId, value);
    
    // 지각 선택 시 자동으로 학부모 알림 ON
    if (value === 'late') {
      onNotifyParentChange(studentId, true);
    }
  };
  
  const handleAbsenceReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const reason = e.target.value as AbsenceReason;
    const autoNotify = ABSENCE_REASONS.find(r => r.value === reason)?.autoNotify || false;
    onAttendanceChange(studentId, 'absent', reason);
    if (autoNotify) {
      onNotifyParentChange(studentId, true);
    }
  };

  const getAttendanceSelectStyle = () => {
    if (isAbsent) return 'border-[#FCA5A5] bg-[#FEF2F2] text-[#DC2626]';
    if (isLate) return 'border-[#FCD34D] bg-[#FEF9E7] text-[#B45309]';
    return 'border-[#E5E7EB] bg-white text-[#1F2937]';
  };

  return (
    <>
      {/* 출결 선택 */}
      <div>
        <label className="block text-xs font-semibold text-[#6B7280] mb-1">출결</label>
        <select
          value={attendanceStatus}
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
                checked={notifyParent}
                onChange={(e) => onNotifyParentChange(studentId, e.target.checked)}
                className="rounded border-[#FCD34D] text-[#F59E0B]"
              />
              <span className="font-medium">학부모 알림</span>
            </label>
            {notifyParent && onSendNotify && (
              <button
                onClick={() => onSendNotify(studentId)}
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
            value={absenceReason || ''}
            onChange={handleAbsenceReasonChange}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
          >
            <option value="">선택</option>
            {ABSENCE_REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          
          {absenceReason === '기타' && (
            <input
              type="text"
              placeholder="사유 입력"
              value={reasonDetail}
              onChange={(e) => {
                setReasonDetail(e.target.value);
                onAttendanceChange(studentId, 'absent', '기타', e.target.value);
              }}
              className="w-full mt-2 px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm bg-white"
            />
          )}
          
          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-2 text-xs text-[#6B7280]">
              <input
                type="checkbox"
                checked={notifyParent}
                onChange={(e) => onNotifyParentChange(studentId, e.target.checked)}
                className="rounded border-[#D1D5DB] text-[#6366F1]"
              />
              <span>학부모 알림</span>
              {absenceReason === '무단' && (
                <span className="text-[#F59E0B] font-semibold">(자동)</span>
              )}
            </label>
            {notifyParent && onSendNotify && (
              <button
                onClick={() => onSendNotify(studentId)}
                disabled={isSendingNotify}
                className="px-3 py-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {isSendingNotify ? '전송중...' : '보내기'}
              </button>
            )}
          </div>
          
          {/* 보강 필요 체크박스 - 사유 선택 후에만 노출 */}
          {absenceReason && (
            <div className="flex items-center mt-2 pt-2 border-t border-[#FECACA]">
              <label className="flex items-center gap-2 text-xs text-[#6B7280]">
                <input
                  type="checkbox"
                  checked={needsMakeup ?? false}
                  onChange={(e) => onNeedsMakeupChange(studentId, e.target.checked)}
                  className="rounded border-[#D1D5DB] text-[#7C3AED]"
                />
                <span className="font-medium text-[#7C3AED]">보강 필요</span>
              </label>
            </div>
          )}
        </div>
      )}
    </>
  );
}
