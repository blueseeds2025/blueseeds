'use client';

interface AddMemoModalProps {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function AddMemoModal({
  isOpen,
  value,
  onChange,
  onConfirm,
  onClose,
}: AddMemoModalProps) {
  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onConfirm();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-[#1F2937] mb-4">메모 필드 추가</h3>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="메모 이름 (예: 숙제, 준비물)"
          className="w-full px-4 py-2 border border-[#E5E7EB] rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
          autoFocus
          onKeyDown={handleKeyDown}
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[#6B7280] hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!value.trim()}
            className="px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] disabled:opacity-50 transition-colors"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
