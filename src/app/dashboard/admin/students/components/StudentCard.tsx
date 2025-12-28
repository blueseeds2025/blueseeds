'use client';

import type { StudentWithClasses } from '../types';
import { gradeToText } from '../types';
import { styles } from '../constants';

type Props = {
  student: StudentWithClasses;
  isSelected: boolean;
  onClick: () => void;
};

export function StudentCard({ student, isSelected, onClick }: Props) {
  return (
    <div
      className={isSelected ? styles.card.selected : styles.card.base}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* 이름 + 상태 배지 */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[#37352F] truncate">
              {student.name}
            </h3>
            <span className={student.is_active ? styles.badge.active : styles.badge.inactive}>
              {student.is_active ? '재원' : '퇴원'}
            </span>
          </div>

          {/* 학교/학년 정보 */}
          <div className="flex items-center gap-2 text-sm text-[#6B7280] mb-2">
            {student.school && (
              <span className="truncate max-w-[120px]">{student.school}</span>
            )}
            {student.school && student.grade && (
              <span className="text-gray-300">·</span>
            )}
            {student.grade && (
              <span>{gradeToText(student.grade)}</span>
            )}
            {!student.school && !student.grade && (
              <span className="text-gray-400">정보 없음</span>
            )}
          </div>

          {/* 수강 반 배지 */}
          {student.classes && student.classes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {student.classes.map((cls) => (
                <span
                  key={cls.class_id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: cls.class_color }}
                  />
                  {cls.class_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
