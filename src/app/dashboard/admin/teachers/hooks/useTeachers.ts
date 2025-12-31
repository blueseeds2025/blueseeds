'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import type { Teacher, TeacherWithDetails, ClassInfo, FeedOptionSet } from '../types';
import { TOAST_MESSAGES } from '../constants';
import {
  listTeachers,
  getTeacherDetails,
  updateTeacherColor,
  saveFeedPermissions,
  assignClass,
  unassignClass,
  getAvailableClasses,
  listFeedOptionSets,
  updateTeacherReportPermission,
} from '../actions/teacher.actions';

export function useTeachers() {
  // ============ State ============
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // 배정 가능한 반/피드 항목
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [feedOptionSets, setFeedOptionSets] = useState<FeedOptionSet[]>([]);

  // ============ Load Teachers ============
  const loadTeachers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listTeachers();
      setTeachers(data);
    } catch (error) {
      console.error('[useTeachers] loadTeachers error:', error);
      toast.error(TOAST_MESSAGES.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  // ============ Select Teacher ============
  const selectTeacher = useCallback(async (teacher: Teacher | null) => {
    if (!teacher) {
      setSelectedTeacher(null);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const [details, classes, optionSets] = await Promise.all([
        getTeacherDetails(teacher.id),
        getAvailableClasses(),
        listFeedOptionSets(),
      ]);

      setSelectedTeacher(details);
      setAvailableClasses(classes);
      setFeedOptionSets(optionSets);
    } catch (error) {
      console.error('[useTeachers] selectTeacher error:', error);
      toast.error(TOAST_MESSAGES.loadFailed);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // ============ Update Color ============
  const handleUpdateColor = useCallback(async (color: string): Promise<boolean> => {
    if (!selectedTeacher) return false;

    const result = await updateTeacherColor(selectedTeacher.id, color);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.colorUpdated);
      // 로컬 상태 업데이트
      setSelectedTeacher((prev) => prev ? { ...prev, color } : null);
      setTeachers((prev) => 
        prev.map((t) => t.id === selectedTeacher.id ? { ...t, color } : t)
      );
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedTeacher]);

  // ============ Feed Permissions ============
  const handleSaveFeedPermissions = useCallback(async (
    permissions: { option_set_id: string; is_allowed: boolean }[]
  ): Promise<boolean> => {
    if (!selectedTeacher) return false;

    const result = await saveFeedPermissions(selectedTeacher.id, permissions);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.permissionsUpdated);
      // 상세 정보 다시 로드
      const details = await getTeacherDetails(selectedTeacher.id);
      setSelectedTeacher(details);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedTeacher]);

  // ============ Class Assignment ============
  const handleAssignClass = useCallback(async (
    classId: string,
    role: 'primary' | 'assistant' = 'primary'
  ): Promise<boolean> => {
    if (!selectedTeacher) return false;

    const result = await assignClass(selectedTeacher.id, classId, role);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.classAssigned);
      // 상세 정보 다시 로드
      const details = await getTeacherDetails(selectedTeacher.id);
      setSelectedTeacher(details);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedTeacher]);

  const handleUnassignClass = useCallback(async (classId: string): Promise<boolean> => {
    if (!selectedTeacher) return false;

    const result = await unassignClass(selectedTeacher.id, classId);
    
    if (result.ok) {
      toast.success(TOAST_MESSAGES.classUnassigned);
      // 상세 정보 다시 로드
      const details = await getTeacherDetails(selectedTeacher.id);
      setSelectedTeacher(details);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedTeacher]);

  // ============ Report Permission ============
  const handleUpdateReportPermission = useCallback(async (
    canViewReports: boolean
  ): Promise<boolean> => {
    if (!selectedTeacher) return false;

    const result = await updateTeacherReportPermission(selectedTeacher.id, canViewReports);
    
    if (result.ok) {
      toast.success(canViewReports ? '리포트 조회 허용' : '리포트 조회 차단');
      // 로컬 상태 업데이트
      setSelectedTeacher((prev) => prev ? { 
        ...prev, 
        permissions: { ...prev.permissions, can_view_reports: canViewReports }
      } : null);
      return true;
    } else {
      toast.error(result.message);
      return false;
    }
  }, [selectedTeacher]);

  // ============ Return ============
  return {
    // 상태
    teachers,
    isLoading,
    selectedTeacher,
    isLoadingDetails,
    availableClasses,
    feedOptionSets,

    // 액션
    loadTeachers,
    selectTeacher,
    handleUpdateColor,
    handleSaveFeedPermissions,
    handleAssignClass,
    handleUnassignClass,
    handleUpdateReportPermission,
  };
}
