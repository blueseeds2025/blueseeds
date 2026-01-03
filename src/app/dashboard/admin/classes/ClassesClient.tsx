'use client';

import { useState } from 'react';
import { Plus, School, Loader2 } from 'lucide-react';

import { useClasses } from './hooks/useClasses';
import { ClassCard } from './components/ClassCard';
import { ClassFormModal } from './components/ClassFormModal';
import { ClassDetailPanel } from './components/ClassDetailPanel';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import type { Class, ClassFormData } from './types';
import { styles } from './constants';

export default function ClassesClient() {
  // ============ Hooks ============
  const {
    classes,
    isLoading,
    selectedClass,
    classTeachers,
    classMembers,
    availableTeachers,
    availableStudents,
    teacherCounts,
    studentCounts,
    handleCreateClass,
    handleUpdateClass,
    handleDeleteClass,
    selectClass,
    handleAssignTeacher,
    handleUnassignTeacher,
    handleEnrollStudent,
    handleUnenrollStudent,
    handleEnrollStudentsBulk,
  } = useClasses();

  // ============ Local State ============
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ============ Handlers ============
  const handleCreate = async (data: ClassFormData) => {
    return await handleCreateClass(data);
  };

  const handleUpdate = async (data: ClassFormData) => {
    if (!editingClass) return false;
    const success = await handleUpdateClass(editingClass.id, data);
    if (success) {
      setEditingClass(null);
    }
    return success;
  };

  const handleDelete = async () => {
    if (!deletingClass) return;
    
    setIsDeleting(true);
    const success = await handleDeleteClass(deletingClass.id);
    setIsDeleting(false);
    
    if (success) {
      setDeletingClass(null);
    }
  };

  // ============ Render ============
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#37352F]">반 관리</h1>
            <p className="text-sm text-[#9B9A97] mt-1">
              반을 만들고, 교사와 학생을 배정하세요
            </p>
          </div>
          <button
            className={styles.button.primary + ' flex items-center gap-2'}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
            새 반 만들기
          </button>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex gap-6">
          {/* 반 목록 */}
          <div className={`${selectedClass ? 'w-1/2' : 'w-full'} transition-all`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#6366F1]" />
              </div>
            ) : classes.length === 0 ? (
              /* 빈 상태 */
              <div className="bg-white rounded-xl border border-[#E8E5E0] p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#EEF2FF] rounded-full flex items-center justify-center">
                  <School className="w-8 h-8 text-[#6366F1]" />
                </div>
                <h3 className="text-lg font-medium text-[#37352F] mb-2">
                  아직 반이 없습니다
                </h3>
                <p className="text-sm text-[#9B9A97] mb-4">
                  첫 번째 반을 만들어보세요!
                </p>
                <button
                  className={styles.button.primary}
                  onClick={() => setShowCreateModal(true)}
                >
                  새 반 만들기
                </button>
              </div>
            ) : (
              /* 반 카드 그리드 */
              <div className={`
                grid gap-4
                ${selectedClass 
                  ? 'grid-cols-1' 
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                }
              `}>
                {classes.map((cls) => (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    isSelected={selectedClass?.id === cls.id}
                    teacherCount={teacherCounts[cls.id] ?? 0}
                    studentCount={studentCounts[cls.id] ?? 0}
                    onSelect={() => selectClass(selectedClass?.id === cls.id ? null : cls)}
                    onEdit={() => setEditingClass(cls)}
                    onDelete={() => setDeletingClass(cls)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 상세 패널 */}
          {selectedClass && (
            <div className="w-1/2">
              <ClassDetailPanel
                cls={selectedClass}
                teachers={classTeachers}
                members={classMembers}
                availableTeachers={availableTeachers}
                availableStudents={availableStudents}
                onClose={() => selectClass(null)}
                onAssignTeacher={handleAssignTeacher}
                onUnassignTeacher={handleUnassignTeacher}
                onEnrollStudent={handleEnrollStudent}
                onUnenrollStudent={handleUnenrollStudent}
                onEnrollStudentsBulk={handleEnrollStudentsBulk}
              />
            </div>
          )}
        </div>
      </div>

      {/* 모달들 */}
      <ClassFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />

      <ClassFormModal
        isOpen={!!editingClass}
        onClose={() => setEditingClass(null)}
        onSubmit={handleUpdate}
        editingClass={editingClass}
      />

      <DeleteConfirmModal
        isOpen={!!deletingClass}
        title="반 삭제"
        message={`"${deletingClass?.name}" 반을 삭제하시겠습니까? 배정된 교사와 학생 정보도 함께 삭제됩니다.`}
        confirmLabel="삭제"
        onConfirm={handleDelete}
        onCancel={() => setDeletingClass(null)}
        isLoading={isDeleting}
      />
    </div>
  );
}
