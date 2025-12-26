'use client';

import { GraduationCap, School } from 'lucide-react';

import type { Teacher } from '../types';

type Props = {
  teacher: Teacher;
  isSelected: boolean;
  onSelect: () => void;
  assignedClassCount?: number;
};

export function TeacherCard({ teacher, isSelected, onSelect, assignedClassCount = 0 }: Props) {
  return (
    <div
      className={`
        bg-white rounded-lg border p-4 cursor-pointer transition-all
        ${isSelected 
          ? 'border-[#6366F1] ring-2 ring-[#6366F1]/20' 
          : 'border-[#E8E5E0] hover:border-[#6366F1]'
        }
      `}
      onClick={onSelect}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        {/* 색상 인디케이터 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: teacher.color || '#6366F1' }}
        >
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        
        <div className="min-w-0">
          <h3 className="font-medium text-[#37352F] truncate">
            {teacher.display_name || teacher.name}
          </h3>
          <p className="text-sm text-[#9B9A97]">선생님</p>
        </div>
      </div>

      {/* 통계 */}
      <div className="flex items-center gap-2 text-sm text-[#9B9A97]">
        <School className="w-4 h-4" />
        <span>담당 반 {assignedClassCount}개</span>
      </div>
    </div>
  );
}
