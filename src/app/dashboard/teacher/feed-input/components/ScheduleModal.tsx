'use client';

interface ScheduleModalProps {
  isOpen: boolean;
  studentName: string;
  date: string;
  hour: string;
  minute: string;
  onDateChange: (date: string) => void;
  onHourChange: (hour: string) => void;
  onMinuteChange: (minute: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function ScheduleModal({
  isOpen,
  studentName,
  date,
  hour,
  minute,
  onDateChange,
  onHourChange,
  onMinuteChange,
  onConfirm,
  onClose,
}: ScheduleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#111827]">보강 날짜 예약</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F3F4F6]"
          >
            <svg className="w-5 h-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <p className="text-sm text-[#6B7280]">
            <span className="font-medium text-[#111827]">{studentName}</span> 학생의 보강 날짜를 예약합니다.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">날짜 *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">시간 (선택)</label>
            <div className="flex gap-2">
              <select
                value={hour}
                onChange={(e) => onHourChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="">시</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={String(i).padStart(2, '0')}>{String(i).padStart(2, '0')}시</option>
                ))}
              </select>
              <select
                value={minute}
                onChange={(e) => onMinuteChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="">분</option>
                {['00', '10', '20', '30', '40', '50'].map(m => (
                  <option key={m} value={m}>{m}분</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-[#E5E7EB] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!date}
            className="flex-1 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] disabled:opacity-50 transition-colors"
          >
            예약
          </button>
        </div>
      </div>
    </div>
  );
}
