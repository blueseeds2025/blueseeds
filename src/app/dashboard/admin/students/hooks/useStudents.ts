'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { toast } from 'sonner';
import type { Student, StudentWithDetails, ClassInfo, StudentWithClasses } from '../types';
import {
  listStudents,
  getStudentDetails,
  createStudent,
  updateStudent,
  archiveStudent,
  restoreStudent,
  deleteStudent,
  getAvailableClasses,
  enrollStudentToClass,
  unenrollStudentFromClass,
  moveStudentToClass,
} from '../actions/student.actions';
import type { StudentFormData } from '../types';

export function useStudents() {
  const [students, setStudents] = useState<StudentWithClasses[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null);
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 토스트 표시 (sonner 사용)
  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text);
    } else {
      toast.error(text);
    }
  }, []);

  // 학생 목록 로드
  const loadStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listStudents();
      setStudents(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
      showToast('error', '학생 목록을 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // 반 목록 로드
  const loadClasses = useCallback(async () => {
    try {
      const data = await getAvailableClasses();
      setAvailableClasses(data);
    } catch (e: any) {
      console.error('[loadClasses] error:', e);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadStudents();
    loadClasses();
  }, [loadStudents, loadClasses]);

  // 학생 선택 (상세 정보 로드)
  const selectStudent = useCallback(async (studentId: string | null) => {
    if (!studentId) {
      setSelectedStudent(null);
      return;
    }

    startTransition(async () => {
      try {
        const details = await getStudentDetails(studentId);
        setSelectedStudent(details);
      } catch (e: any) {
        showToast('error', '학생 정보를 불러오지 못했습니다');
      }
    });
  }, [showToast]);

  // 학생 생성
  const handleCreateStudent = useCallback(async (formData: StudentFormData): Promise<boolean> => {
    const result = await createStudent(formData);
    if (result.ok) {
      showToast('success', '학생이 등록되었습니다');
      await loadStudents();
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [loadStudents, showToast]);

  // 학생 수정
  const handleUpdateStudent = useCallback(async (studentId: string, formData: StudentFormData): Promise<boolean> => {
    const result = await updateStudent(studentId, formData);
    if (result.ok) {
      showToast('success', '학생 정보가 수정되었습니다');
      await loadStudents();
      if (selectedStudent?.id === studentId) {
        await selectStudent(studentId);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [loadStudents, selectStudent, selectedStudent, showToast]);

  // 학생 아카이브 (퇴원)
  const handleArchiveStudent = useCallback(async (studentId: string): Promise<boolean> => {
    const result = await archiveStudent(studentId);
    if (result.ok) {
      showToast('success', '학생이 퇴원 처리되었습니다');
      await loadStudents();
      if (selectedStudent?.id === studentId) {
        await selectStudent(studentId);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [loadStudents, selectStudent, selectedStudent, showToast]);

  // 학생 복구 (재원)
  const handleRestoreStudent = useCallback(async (studentId: string): Promise<boolean> => {
    const result = await restoreStudent(studentId);
    if (result.ok) {
      showToast('success', '학생이 재원 처리되었습니다');
      await loadStudents();
      if (selectedStudent?.id === studentId) {
        await selectStudent(studentId);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [loadStudents, selectStudent, selectedStudent, showToast]);

  // 학생 삭제
  const handleDeleteStudent = useCallback(async (studentId: string): Promise<boolean> => {
    const result = await deleteStudent(studentId);
    if (result.ok) {
      showToast('success', '학생이 삭제되었습니다');
      await loadStudents();
      if (selectedStudent?.id === studentId) {
        setSelectedStudent(null);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [loadStudents, selectedStudent, showToast]);

  // 반 등록
  const handleEnrollToClass = useCallback(async (studentId: string, classId: string): Promise<boolean> => {
    const result = await enrollStudentToClass(studentId, classId);
    if (result.ok) {
      showToast('success', '반에 등록되었습니다');
      if (selectedStudent?.id === studentId) {
        await selectStudent(studentId);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [selectStudent, selectedStudent, showToast]);

  // 반 등록 해제
  const handleUnenrollFromClass = useCallback(async (studentId: string, classId: string): Promise<boolean> => {
    const result = await unenrollStudentFromClass(studentId, classId);
    if (result.ok) {
      showToast('success', '반에서 제거되었습니다');
      if (selectedStudent?.id === studentId) {
        await selectStudent(studentId);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [selectStudent, selectedStudent, showToast]);

  // 반 이동
  const handleMoveToClass = useCallback(async (
    studentId: string, 
    fromClassId: string, 
    toClassId: string
  ): Promise<boolean> => {
    const result = await moveStudentToClass(studentId, fromClassId, toClassId);
    if (result.ok) {
      showToast('success', '반이 이동되었습니다');
      if (selectedStudent?.id === studentId) {
        await selectStudent(studentId);
      }
      return true;
    } else {
      showToast('error', result.message);
      return false;
    }
  }, [selectStudent, selectedStudent, showToast]);

  return {
    // 데이터
    students,
    selectedStudent,
    availableClasses,
    
    // 상태
    isLoading,
    isPending,
    error,
    
    // 선택
    selectStudent,
    
    // 학생 CRUD
    createStudent: handleCreateStudent,
    updateStudent: handleUpdateStudent,
    archiveStudent: handleArchiveStudent,
    restoreStudent: handleRestoreStudent,
    deleteStudent: handleDeleteStudent,
    
    // 반 등록
    enrollToClass: handleEnrollToClass,
    unenrollFromClass: handleUnenrollFromClass,
    moveToClass: handleMoveToClass,
    
    // 리로드
    refresh: loadStudents,
  };
}
