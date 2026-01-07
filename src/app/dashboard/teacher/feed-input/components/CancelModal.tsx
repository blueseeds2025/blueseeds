'use client';

interface CancelModalProps {
  isOpen: boolean;
  studentName: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancelModal({
  isOpen,
  studentName,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: CancelModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#111827]">보강 안함 처리</h2>
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
            <span className="font-medium text-[#111827]">{studentName}</span> 학생의 보강을 취소합니다.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">사유 *</label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="예: 학부모 요청으로 보강 불필요"
              rows={3}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-[#E5E7EB] flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            닫기
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            className="flex-1 px-4 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] disabled:opacity-50 transition-colors"
          >
            보강 안함
          </button>
        </div>
      </div>
    </div>
  );
}
