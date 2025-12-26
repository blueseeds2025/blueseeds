'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import type { Class, ClassFormData, ClassTeacher, ClassMember } from '../types';
import { TOAST_MESSAGES } from '../constants';
import {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  getClassTeachers,
  getClassMembers,
  assignTeacher,
  unassignTeacher,
  enrollStudent,
  unenrollStudent,
  enrollStudentsBulk,
  getAvailableTeachers,
  getAvailableStudents,
} from '../actions/class.actions';

export function useClasses() {
  // ============ State ============
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  
  // 선택된 반의 교사/학생
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  
  // 배정 가능한 교사/학생
  const [availableTeachers, setAvailableTeachers] = useState<{ id: string; name: string; display_name: string }[]>([]);
  const [availableStudents, setAvailableStudents] = useState<{ id: string; name: string; display_code: string }[]>([]);

  // ============ Load Classes ============
  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listClasses();
      setClasses(data);
    } catch (error) {
      console.error('[useClasses] loadClasses error:', error);
      toast.error(TOAST_MESSAGES.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  // ============ Class CRUD ============
  const handleCreateClass = useCallback(async (formData: ClassFormData): Promise<boolean> => {
    const result = await createClass(formData);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.classCreated);
      await loadClasses();
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [loadClasses]);

  const handleUpdateClass = useCallback(async (classId: string, formData: ClassFormData): Promise<boolean> => {
    const result = await updateClass(classId, formData);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.classUpdated);
      await loadClasses();
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [loadClasses]);

  const handleDeleteClass = useCallback(async (classId: string): Promise<boolean> => {
    const result = await deleteClass(classId);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.classDeleted);
      setSelectedClass(null);
      await loadClasses();
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [loadClasses]);

  // ============ Select Class & Load Details ============
  const selectClass = useCallback(async (cls: Class | null) => {
    setSelectedClass(cls);
    
    if (!cls) {
      setClassTeachers([]);
      setClassMembers([]);
      setAvailableTeachers([]);
      setAvailableStudents([]);
      return;
    }

    try {
      // 병렬로 데이터 로드
      const [teachers, members, availTeachers, availStudents] = await Promise.all([
        getClassTeachers(cls.id),
        getClassMembers(cls.id),
        getAvailableTeachers(),
        getAvailableStudents(cls.id),
      ]);

      setClassTeachers(teachers);
      setClassMembers(members);
      setAvailableTeachers(availTeachers);
      setAvailableStudents(availStudents);
    } catch (error) {
      console.error('[useClasses] selectClass error:', error);
      toast.error(TOAST_MESSAGES.loadFailed);
    }
  }, []);

  // ============ Teacher Assignment ============
  const handleAssignTeacher = useCallback(async (teacherId: string, role: 'primary' | 'assistant' = 'primary'): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await assignTeacher(selectedClass.id, teacherId, role);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.teacherAssigned);
      await selectClass(selectedClass); // 상세 정보 리로드
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass]);

  const handleUnassignTeacher = useCallback(async (teacherId: string): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await unassignTeacher(selectedClass.id, teacherId);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.teacherUnassigned);
      await selectClass(selectedClass);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass]);

  // ============ Student Enrollment ============
  const handleEnrollStudent = useCallback(async (studentId: string): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await enrollStudent(selectedClass.id, studentId);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.studentEnrolled);
      await selectClass(selectedClass);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass]);

  const handleUnenrollStudent = useCallback(async (studentId: string): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await unenrollStudent(selectedClass.id, studentId);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.studentUnenrolled);
      await selectClass(selectedClass);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass]);

  const handleEnrollStudentsBulk = useCallback(async (studentIds: string[]): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await enrollStudentsBulk(selectedClass.id, studentIds);
    
    if (result.ok) {
      toast.success(`${result.data?.count}명의 학생이 등록되었습니다`);
      await selectClass(selectedClass);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass]);

  // ============ Return ============
  return {
    // 상태
    classes,
    isLoading,
    selectedClass,
    classTeachers,
    classMembers,
    availableTeachers,
    availableStudents,

    // 반 CRUD
    loadClasses,
    handleCreateClass,
    handleUpdateClass,
    handleDeleteClass,

    // 반 선택
    selectClass,

    // 교사 배정
    handleAssignTeacher,
    handleUnassignTeacher,

    // 학생 등록
    handleEnrollStudent,
    handleUnenrollStudent,
    handleEnrollStudentsBulk,
  };
}
