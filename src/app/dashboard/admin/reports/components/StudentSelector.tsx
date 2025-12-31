'use client';

import { useState, useEffect } from 'react';

interface StudentSelectorProps {
  classes: { id: string; name: string }[];
  students: { id: string; name: string; display_code: string | null }[];
  selectedClassId: string | null;
  selectedStudentIds: string[];
  onClassChange: (classId: string | null) => void;
  onStudentChange: (studentIds: string[]) => void;
  isLoading?: boolean;
}

export function StudentSelector({
  classes,
  students,
  selectedClassId,
  selectedStudentIds,
  onClassChange,
  onStudentChange,
  isLoading = false,
}: StudentSelectorProps) {
  const [selectAll, setSelectAll] = useState(false);
  
  // 전체 선택 상태 동기화
  useEffect(() => {
    if (students.length > 0 && selectedStudentIds.length === students.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [students.length, selectedStudentIds.length]);
  
  const handleClassChange = (classId: string) => {
    onClassChange(classId || null);
    onStudentChange([]); // 반 변경 시 선택 초기화
    setSelectAll(false);
  };
  
  const handleSelectAll = () => {
    if (selectAll) {
      onStudentChange([]);
    } else {
      onStudentChange(students.map(s => s.id));
    }
    setSelectAll(!selectAll);
  };
  
  const handleStudentToggle = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      onStudentChange(selectedStudentIds.filter(id => id !== studentId));
    } else {
      onStudentChange([...selectedStudentIds, studentId]);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* 반 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          반 선택
        </label>
        <select
          value={selectedClassId || ''}
          onChange={(e) => handleClassChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
        >
          <option value="">반을 선택하세요</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* 학생 선택 */}
      {selectedClassId && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              학생 선택 
              <span className="ml-2 text-gray-500">
                ({selectedStudentIds.length}/{students.length}명)
              </span>
            </label>
            <button
              onClick={handleSelectAll}
              className="text-sm text-[#6366F1] hover:text-[#4F46E5]"
            >
              {selectAll ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-[#6366F1]" />
              <p className="mt-2 text-sm">학생 목록을 불러오는 중...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <p className="text-sm">해당 반에 학생이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
              {students.map((student) => {
                const isSelected = selectedStudentIds.includes(student.id);
                return (
                  <button
                    key={student.id}
                    onClick={() => handleStudentToggle(student.id)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors text-left ${
                      isSelected
                        ? 'bg-[#EEF2FF] border-[#A5B4FC] text-[#4F46E5]'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? 'bg-[#6366F1] border-[#6366F1]' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="truncate">{student.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}