'use client';

import { Users, GraduationCap, MoreVertical, Pencil, Trash2 } from 'lucide-react';

import type { Class } from '../types';
import { styles } from '../constants';

type Props = {
  cls: Class;
  isSelected: boolean;
  teacherCount: number;
  studentCount: number;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function ClassCard({
  cls,
  isSelected,
  teacherCount,
  studentCount,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
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
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* 색상 인디케이터 */}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: cls.color }}
          />
          <h3 className="font-medium text-[#37352F] truncate">{cls.name}</h3>
        </div>

        {/* 더보기 메뉴 */}
        <div className="relative group">
          <button
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>

          {/* 드롭다운 메뉴 */}
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E8E5E0] py-1 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
            <button
              className="w-full px-3 py-2 text-left text-sm text-[#37352F] hover:bg-gray-50 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="w-4 h-4" />
              수정
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="flex items-center gap-4 text-sm text-[#9B9A97]">
        <div className="flex items-center gap-1">
          <GraduationCap className="w-4 h-4" />
          <span>교사 {teacherCount}명</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4" />
          <span>학생 {studentCount}명</span>
        </div>
      </div>
    </div>
  );
}
