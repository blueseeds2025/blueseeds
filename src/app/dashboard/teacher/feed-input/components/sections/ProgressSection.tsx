'use client';

interface ProgressSectionProps {
  studentId: string;
  progressText?: string;
  previousProgress?: string;
  onProgressChange: (studentId: string, progress: string) => void;
}

export default function ProgressSection({
  studentId,
  progressText,
  previousProgress,
  onProgressChange,
}: ProgressSectionProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#6B7280] mb-1">
        진도
        {previousProgress && (
          <span className="text-[#9CA3AF] font-normal ml-1">(이전: {previousProgress})</span>
        )}
      </label>
      <input
        type="text"
        placeholder={previousProgress || '진도 입력'}
        value={progressText || ''}
        onChange={(e) => onProgressChange(studentId, e.target.value)}
        className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
      />
    </div>
  );
}
