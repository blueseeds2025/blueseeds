'use client';

import { FeedOptionSet } from '../../types';

interface FeedItemsSectionProps {
  studentId: string;
  optionSets: FeedOptionSet[];
  feedValues: Record<string, string | null>;
  onOpenOptionPicker: (studentId: string, setId: string, anchorEl: HTMLElement) => void;
}

export default function FeedItemsSection({
  studentId,
  optionSets,
  feedValues,
  onOpenOptionPicker,
}: FeedItemsSectionProps) {
  const getOptionLabel = (setId: string): string => {
    const optionId = feedValues[setId];
    if (!optionId) return '선택';
    const set = optionSets.find(s => s.id === setId);
    const option = set?.options.find(o => o.id === optionId);
    return option?.label || '선택';
  };

  if (optionSets.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {optionSets.map((set) => {
        const isEmpty = !feedValues[set.id];
        return (
          <div key={set.id}>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1">
              {set.name}<span className="text-[#EF4444]">*</span>
            </label>
            <button
              type="button"
              tabIndex={0}
              onFocus={(e) => {
                onOpenOptionPicker(studentId, set.id, e.currentTarget);
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenOptionPicker(studentId, set.id, e.currentTarget);
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
  );
}
