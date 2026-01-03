'use client';

import { Users, GraduationCap, Clock } from 'lucide-react';

import type { Class, ClassSchedule } from '../types';

const DAY_NAMES: Record<number, string> = {
  0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
};

type Props = {
  cls: Class;
  isSelected: boolean;
  teacherCount: number;
  studentCount: number;
  schedules: ClassSchedule[];
  onSelect: () => void;
};

// 스케줄을 시간대별로 그룹핑하여 표시
function formatSchedules(schedules: ClassSchedule[]): string {
  if (schedules.length === 0) return '시간 미설정';
  
  // 시간대별로 그룹핑 (같은 시작/종료 시간끼리)
  const grouped: Record<string, number[]> = {};
  
  for (const s of schedules) {
    const timeKey = `${s.startTime}~${s.endTime}`;
    if (!grouped[timeKey]) {
      grouped[timeKey] = [];
    }
    grouped[timeKey].push(s.dayOfWeek);
  }
  
  // 각 시간대별 요일 묶음 생성
  const parts: string[] = [];
  for (const [time, days] of Object.entries(grouped)) {
    const sortedDays = days.sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
    const dayStr = sortedDays.map(d => DAY_NAMES[d]).join('/');
    parts.push(`${dayStr} ${time.split('~')[0]}`);
  }
  
  return parts.join(', ');
}

export function ClassCard({
  cls,
  isSelected,
  teacherCount,
  studentCount,
  schedules,
  onSelect,
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
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: cls.color }}
        />
        <h3 className="font-medium text-[#37352F] truncate">{cls.name}</h3>
      </div>

      {/* 스케줄 표시 */}
      <div className="flex items-center gap-1 mb-3 text-sm text-[#6366F1]">
        <Clock className="w-4 h-4" />
        <span className="truncate">{formatSchedules(schedules)}</span>
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
