'use client';

import { MemoField } from '../../types';

interface MemoSectionProps {
  studentId: string;
  memoFields: MemoField[];
  memoValues: Record<string, string>;
  onMemoChange: (studentId: string, fieldId: string, value: string) => void;
}

export default function MemoSection({
  studentId,
  memoFields,
  memoValues,
  onMemoChange,
}: MemoSectionProps) {
  if (memoFields.length === 0) return null;

  return (
    <div className="space-y-2">
      {memoFields.map((field) => (
        <div key={field.id}>
          <label className="block text-xs font-semibold text-[#6B7280] mb-1">
            {field.name}
          </label>
          <input
            type="text"
            placeholder={`${field.name} 입력`}
            value={memoValues[field.id] || ''}
            onChange={(e) => onMemoChange(studentId, field.id, e.target.value)}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
          />
        </div>
      ))}
    </div>
  );
}
