'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ExamType } from '../../types';

interface ExamScoreSectionProps {
  studentId: string;
  examTypes: ExamType[];
  examScores: Record<string, number | null>;
  onExamScoreChange: (studentId: string, setId: string, score: number | null) => void;
}

export default function ExamScoreSection({
  studentId,
  examTypes,
  examScores,
  onExamScoreChange,
}: ExamScoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 입력된 시험 개수
  const filledCount = Object.values(examScores).filter(v => v !== null && v !== undefined).length;
  
  if (examTypes.length === 0) return null;
  
  return (
    <div className={`rounded-lg border-2 overflow-hidden ${
      filledCount > 0 
        ? 'border-[#10B981]'  // 초록 (입력됨)
        : 'border-[#FCA5A5]'  // 빨강 (비어있음)
    }`}>
      {/* 헤더 - 클릭하면 펼치기/접기 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${
          filledCount > 0
            ? 'bg-[#D1FAE5] hover:bg-[#A7F3D0]'  // 초록 배경
            : 'bg-[#FEE2E2] hover:bg-[#FECACA]'  // 빨강 배경
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${
            filledCount > 0 ? 'text-[#059669]' : 'text-[#DC2626]'
          }`}>📝 시험 점수</span>
          {filledCount > 0 && (
            <span className="px-1.5 py-0.5 bg-[#10B981] text-white text-xs rounded-full">
              {filledCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className={`w-4 h-4 ${filledCount > 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${filledCount > 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`} />
        )}
      </button>
      
      {/* 펼쳐진 내용 */}
      {isExpanded && (
        <div className="p-3 bg-white space-y-2">
          {examTypes.map((exam) => {
            const score = examScores[exam.id];
            const hasValue = score !== null && score !== undefined;
            
            return (
              <div key={exam.id} className="flex items-center gap-2">
                <label className="flex-1 text-sm text-[#374151] truncate">
                  {exam.name}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="-"
                    value={score ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        onExamScoreChange(studentId, exam.id, null);
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num) && num >= 0 && num <= 100) {
                          onExamScoreChange(studentId, exam.id, num);
                        }
                      }
                    }}
                    className={`
                      w-16 px-2 py-1.5 text-sm text-center rounded-lg font-medium
                      focus:outline-none focus:ring-2
                      ${hasValue 
                        ? 'border-2 border-[#10B981] bg-[#D1FAE5] text-[#059669] focus:ring-[#10B981]/30' 
                        : 'border-2 border-[#FCA5A5] bg-[#FEE2E2] text-[#DC2626] focus:ring-[#DC2626]/30'
                      }
                    `}
                  />
                  <span className="text-xs text-[#9CA3AF]">점</span>
                </div>
              </div>
            );
          })}
          
          {/* 안내 문구 */}
          <p className="text-xs text-[#9CA3AF] mt-2 pt-2 border-t border-[#F3F4F6]">
            💡 시험이 없으면 비워두세요 (0~100점)
          </p>
        </div>
      )}
    </div>
  );
}
