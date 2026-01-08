'use client';

import { useState, useEffect } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';

import { useTeachers } from './hooks/useTeachers';
import { TeacherCard } from './components/TeacherCard';
import { TeacherDetailPanel } from './components/TeacherDetailPanel';
import type { Teacher } from './types';

export default function TeachersClient() {
  // ============ Hooks ============
  const {
    teachers,
    isLoading,
    selectedTeacher,
    isLoadingDetails,
    availableClasses,
    feedOptionSets,
    selectTeacher,
    handleUpdateColor,
    handleSaveFeedPermissions,
    handleAssignClass,
    handleUnassignClass,
    handleUpdateReportPermission,
  } = useTeachers();

  // ✅ 담당 반 카운트 - 서버 데이터 기반 + 선택 시 업데이트
  const [localClassCounts, setLocalClassCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (selectedTeacher) {
      setLocalClassCounts((prev) => ({
        ...prev,
        [selectedTeacher.id]: selectedTeacher.assignedClasses.length,
      }));
    }
  }, [selectedTeacher]);

  // ✅ 카운트 계산 함수: 로컬 업데이트가 있으면 로컬 값, 없으면 서버 값
  const getClassCount = (teacher: Teacher) => {
    if (localClassCounts[teacher.id] !== undefined) {
      return localClassCounts[teacher.id];
    }
    return teacher.classCount ?? 0;  // ✅ 서버에서 받은 값 사용
  };

  // ============ Render ============
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#37352F]">교사 관리</h1>
          <p className="text-sm text-[#9B9A97] mt-1">
            교사별 담당 반과 피드 항목 권한을 설정하세요
          </p>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex gap-6">
          {/* 교사 목록 */}
          <div className={`${selectedTeacher ? 'w-1/2' : 'w-full'} transition-all`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#6366F1]" />
              </div>
            ) : teachers.length === 0 ? (
              /* 빈 상태 */
              <div className="bg-white rounded-xl border border-[#E8E5E0] p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#EEF2FF] rounded-full flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-[#6366F1]" />
                </div>
                <h3 className="text-lg font-medium text-[#37352F] mb-2">
                  등록된 교사가 없습니다
                </h3>
                <p className="text-sm text-[#9B9A97]">
                  먼저 교사 계정을 등록해주세요
                </p>
              </div>
            ) : (
              /* 교사 카드 그리드 */
              <div className={`
                grid gap-4
                ${selectedTeacher 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }
              `}>
                {teachers.map((teacher) => (
                  <TeacherCard
                    key={teacher.id}
                    teacher={teacher}
                    isSelected={selectedTeacher?.id === teacher.id}
                    assignedClassCount={getClassCount(teacher)}
                    onSelect={() => selectTeacher(
                      selectedTeacher?.id === teacher.id ? null : teacher
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 상세 패널 */}
          {selectedTeacher && (
            <div className="w-1/2">
              {isLoadingDetails ? (
                <div className="bg-white rounded-lg border border-[#E8E5E0] h-96 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#6366F1]" />
                </div>
              ) : (
                <TeacherDetailPanel
                  teacher={selectedTeacher}
                  availableClasses={availableClasses}
                  feedOptionSets={feedOptionSets}
                  onClose={() => selectTeacher(null)}
                  onUpdateColor={handleUpdateColor}
                  onSaveFeedPermissions={handleSaveFeedPermissions}
                  onAssignClass={handleAssignClass}
                  onUnassignClass={handleUnassignClass}
                  onUpdateReportPermission={handleUpdateReportPermission}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
