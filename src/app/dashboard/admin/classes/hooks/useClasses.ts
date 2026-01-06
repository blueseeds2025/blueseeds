'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import type { Class, ClassFormData, ClassTeacher, ClassMember, ClassSchedule } from '../types';
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
  getClassCounts,
  getClassSchedules,
  addClassSchedule,
  addClassSchedulesBulk,
  removeClassSchedule,
} from '../actions/class.actions';
import { moveStudentToClass } from '../../students/actions/student.actions';

export function useClasses() {
  // ============ State ============
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  
  // 모든 반의 교사/학생 카운트 + 스케줄
  const [teacherCounts, setTeacherCounts] = useState<Record<string, number>>({});
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [schedulesMap, setSchedulesMap] = useState<Record<string, ClassSchedule[]>>({});
  
  // 선택된 반의 교사/학생
  const [classTeachers, setClassTeachers] = useState<ClassTeacher[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  
  // 배정 가능한 교사/학생
  const [availableTeachers, setAvailableTeachers] = useState<{ id: string; name: string; display_name: string }[]>([]);
  const [availableStudents, setAvailableStudents] = useState<{ id: string; name: string; display_code: string }[]>([]);
  
  // 선택된 반의 스케줄
  const [classSchedules, setClassSchedules] = useState<ClassSchedule[]>([]);

  // ============ Load Classes ============
  const loadClasses = useCallback(async () => {
    setIsLoading(true);
    try {
      // 반 목록과 카운트를 병렬로 로드
      const [data, counts] = await Promise.all([
        listClasses(),
        getClassCounts(),
      ]);
      setClasses(data);
      setTeacherCounts(counts.teacherCounts);
      setStudentCounts(counts.studentCounts);
      setSchedulesMap(counts.schedulesMap);
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

  // ============ Select Class & Load Details ============
  const selectClass = useCallback(async (cls: Class | null) => {
    setSelectedClass(cls);
    
    if (!cls) {
      setClassTeachers([]);
      setClassMembers([]);
      setAvailableTeachers([]);
      setAvailableStudents([]);
      setClassSchedules([]);
      return;
    }

    try {
      // 병렬로 데이터 로드
      const [teachers, members, availTeachers, availStudents, schedules] = await Promise.all([
        getClassTeachers(cls.id),
        getClassMembers(cls.id),
        getAvailableTeachers(),
        getAvailableStudents(cls.id),
        getClassSchedules(cls.id),
      ]);

      setClassTeachers(teachers);
      setClassMembers(members);
      setAvailableTeachers(availTeachers);
      setAvailableStudents(availStudents);
      setClassSchedules(schedules);
      
      // 카운트도 업데이트
      setTeacherCounts(prev => ({ ...prev, [cls.id]: teachers.length }));
      setStudentCounts(prev => ({ ...prev, [cls.id]: members.length }));
    } catch (error) {
      console.error('[useClasses] selectClass error:', error);
      toast.error(TOAST_MESSAGES.loadFailed);
    }
  }, []);

  // ============ Class CRUD ============
  const handleCreateClass = useCallback(async (formData: ClassFormData): Promise<boolean> => {
    const result = await createClass(formData);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.classCreated);
      await loadClasses();
      
      // 생성된 반 자동 선택
      if (result.data?.id) {
        const newClassList = await listClasses();
        const newClass = newClassList.find(c => c.id === result.data!.id);
        if (newClass) {
          await selectClass(newClass);
        }
      }
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [loadClasses, selectClass]);

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

  const handleMoveStudent = useCallback(async (studentId: string, toClassId: string): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await moveStudentToClass(studentId, selectedClass.id, toClassId);
    
    if (result.ok) {
      toast.success('학생이 이동되었습니다');
      await selectClass(selectedClass);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass]);

  // ============ Schedule Management ============
  const handleAddSchedule = useCallback(async (
    dayOfWeek: number, 
    startTime: string, 
    endTime: string
  ): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await addClassSchedule(selectedClass.id, dayOfWeek, startTime, endTime);
    
    if (result.ok) {
      toast.success('시간이 추가되었습니다');
      await selectClass(selectedClass);
      await loadClasses();
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass, selectClass, loadClasses]);

  // 일괄 스케줄 추가 (낙관적 업데이트)
  const handleAddSchedulesBulk = useCallback(async (
    schedules: { dayOfWeek: number; startTime: string; endTime: string }[]
  ): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await addClassSchedulesBulk(selectedClass.id, schedules);
    
    if (result.ok && result.data?.created) {
      toast.success(`${result.data.created.length}개 시간이 추가되었습니다`);
      // 낙관적 업데이트 - 로컬 상태만 업데이트
      setClassSchedules(prev => [...prev, ...result.data!.created]);
      setSchedulesMap(prev => ({
        ...prev,
        [selectedClass.id]: [...(prev[selectedClass.id] || []), ...result.data!.created]
      }));
      return true;
    } else {
     toast.error(!result.ok ? result.message : '오류가 발생했습니다');
      return false;
    }
  }, [selectedClass]);

  const handleRemoveSchedule = useCallback(async (scheduleId: string): Promise<boolean> => {
    if (!selectedClass) return false;

    // 낙관적 업데이트 - 먼저 UI에서 제거
    setClassSchedules(prev => prev.filter(s => s.id !== scheduleId));
    setSchedulesMap(prev => ({
      ...prev,
      [selectedClass.id]: (prev[selectedClass.id] || []).filter(s => s.id !== scheduleId)
    }));

    const result = await removeClassSchedule(scheduleId);
    
    if (result.ok) {
      toast.success('시간이 삭제되었습니다');
      return true;
    } else {
      // 실패시 롤백 - 다시 로드
      toast.error(result.message);
      await selectClass(selectedClass);
      return false;
    }
  }, [selectedClass, selectClass]);

  // ============ Color Change ============
  const handleChangeColor = useCallback(async (color: string): Promise<boolean> => {
    if (!selectedClass) return false;

    const result = await updateClass(selectedClass.id, { color });
    
    if (result.ok) {
      toast.success('색상이 변경되었습니다');
      // 로컬 상태 업데이트
      setClasses(prev => prev.map(c => 
        c.id === selectedClass.id ? { ...c, color } : c
      ));
      setSelectedClass(prev => prev ? { ...prev, color } : null);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedClass]);

  // ============ Return ============
  return {
    // 상태
    classes,
    isLoading,
    selectedClass,
    classTeachers,
    classMembers,
    classSchedules,
    availableTeachers,
    availableStudents,
    teacherCounts,
    studentCounts,
    schedulesMap,

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
    handleMoveStudent,

    // 스케줄 관리
    handleAddSchedule,
    handleAddSchedulesBulk,
    handleRemoveSchedule,

    // 색상 변경
    handleChangeColor,
  };
}
