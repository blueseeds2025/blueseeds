'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Filter, Users, UserX, Loader2 } from 'lucide-react';

import { useStudents } from './hooks/useStudents';
import { 
  StudentCard, 
  StudentFormModal, 
  StudentDetailPanel,
  DeleteConfirmModal,
} from './components';
import { styles, FILTER_OPTIONS, getGradeGroup } from './constants';
import type { StudentWithClasses } from './types';

type StatusFilter = 'all' | 'active' | 'inactive';
type GradeFilter = 'all' | 'elementary' | 'middle' | 'high';

export function StudentsClient() {
  // 데이터 & 액션
  const {
    students,
    selectedStudent,
    availableClasses,
    isLoading,
    isPending,
    toastMessage,
    selectStudent,
    createStudent,
    updateStudent,
    archiveStudent,
    restoreStudent,
    deleteStudent,
    enrollToClass,
    unenrollFromClass,
    moveToClass,
  } = useStudents();

  // UI 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // 필터링된 학생 목록
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 검색어 필터
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = student.name.toLowerCase().includes(query);
        const matchCode = student.display_code.toLowerCase().includes(query);
        const matchSchool = student.school?.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchSchool) return false;
      }

      // 상태 필터
      if (statusFilter === 'active' && !student.is_active) return false;
      if (statusFilter === 'inactive' && student.is_active) return false;

      // 학년 필터
      if (gradeFilter !== 'all') {
        const gradeGroup = getGradeGroup(student.grade);
        if (gradeGroup !== gradeFilter) return false;
      }

      return true;
    });
  }, [students, searchQuery, statusFilter, gradeFilter]);

  // 통계
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.is_active).length,
    inactive: students.filter(s => !s.is_active).length,
  }), [students]);

  return (
    <div className="h-full flex">
      {/* 좌측: 학생 목록 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <div className="p-4 border-b border-[#E8E5E0] bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-[#37352F]">학생 관리</h1>
              <p className="text-sm text-[#9B9A97] mt-1">
                재원 {stats.active}명 / 퇴원 {stats.inactive}명
              </p>
            </div>
            <button
              className={styles.button.primary + ' flex items-center gap-2'}
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              학생 등록
            </button>
          </div>

          {/* 검색 & 필터 */}
          <div className="flex gap-2">
            {/* 검색 */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름, 코드, 학교로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            </div>

            {/* 상태 필터 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] bg-white"
            >
              {FILTER_OPTIONS.status.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {/* 학년 필터 */}
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value as GradeFilter)}
              className="px-3 py-2 border border-[#E8E5E0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] bg-white"
            >
              {FILTER_OPTIONS.grade.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 학생 목록 */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#F9F8F6]">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-[#6366F1] animate-spin" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              {searchQuery || statusFilter !== 'all' || gradeFilter !== 'all' ? (
                <>
                  <Filter className="w-12 h-12 mb-3 opacity-50" />
                  <p>검색 결과가 없습니다</p>
                </>
              ) : (
                <>
                  <Users className="w-12 h-12 mb-3 opacity-50" />
                  <p>등록된 학생이 없습니다</p>
                  <button
                    className="mt-4 text-[#6366F1] hover:underline"
                    onClick={() => setShowCreateModal(true)}
                  >
                    첫 학생 등록하기
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  isSelected={selectedStudent?.id === student.id}
                  onClick={() => selectStudent(student.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 우측: 학생 상세 패널 */}
      {selectedStudent && (
        <div className="w-96 border-l border-[#E8E5E0] bg-white flex-shrink-0">
          <StudentDetailPanel
            student={selectedStudent}
            availableClasses={availableClasses}
            onClose={() => selectStudent(null)}
            onEdit={() => setShowEditModal(true)}
            onArchive={() => setShowArchiveModal(true)}
            onRestore={() => restoreStudent(selectedStudent.id)}
            onDelete={() => setShowDeleteModal(true)}
            onEnrollToClass={(classId) => enrollToClass(selectedStudent.id, classId)}
            onUnenrollFromClass={(classId) => unenrollFromClass(selectedStudent.id, classId)}
            onMoveToClass={(fromId, toId) => moveToClass(selectedStudent.id, fromId, toId)}
          />
        </div>
      )}

      {/* 학생 생성 모달 */}
      {showCreateModal && (
        <StudentFormModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createStudent}
        />
      )}

      {/* 학생 수정 모달 */}
      {showEditModal && selectedStudent && (
        <StudentFormModal
          student={selectedStudent}
          onClose={() => setShowEditModal(false)}
          onSubmit={(data) => updateStudent(selectedStudent.id, data)}
        />
      )}

      {/* 퇴원 확인 모달 */}
      {showArchiveModal && selectedStudent && (
        <DeleteConfirmModal
          title="학생 퇴원 처리"
          message={`${selectedStudent.name} 학생을 퇴원 처리하시겠습니까? 모든 반에서 자동으로 제거됩니다.`}
          confirmText="퇴원 처리"
          onConfirm={() => archiveStudent(selectedStudent.id)}
          onCancel={() => setShowArchiveModal(false)}
        />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && selectedStudent && (
        <DeleteConfirmModal
          title="학생 삭제"
          message={`${selectedStudent.name} 학생을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmText="삭제"
          onConfirm={() => deleteStudent(selectedStudent.id)}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div 
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg z-50
            ${toastMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
          `}
        >
          {toastMessage.text}
        </div>
      )}

      {/* 로딩 오버레이 */}
      {isPending && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#6366F1] animate-spin" />
            <span>처리 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}
