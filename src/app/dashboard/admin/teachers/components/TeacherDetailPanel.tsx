'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Check, ChevronRight, ChevronLeft, Lock, ChevronDown, ChevronUp } from 'lucide-react';

import type { TeacherWithDetails, ClassInfo, FeedOptionSet } from '../types';
import { TEACHER_COLORS, TEACHER_ROLES } from '../constants';

type Props = {
  teacher: TeacherWithDetails;
  availableClasses: ClassInfo[];
  feedOptionSets: FeedOptionSet[];
  onClose: () => void;
  onUpdateColor: (color: string) => Promise<boolean>;
  onSaveFeedPermissions: (permissions: { option_set_id: string; is_allowed: boolean }[]) => Promise<boolean>;
  onAssignClass: (classId: string, role: 'primary' | 'assistant') => Promise<boolean>;
  onUnassignClass: (classId: string) => Promise<boolean>;
  onUpdateReportPermission: (canViewReports: boolean) => Promise<boolean>;
};

export function TeacherDetailPanel({
  teacher,
  availableClasses,
  feedOptionSets,
  onClose,
  onUpdateColor,
  onSaveFeedPermissions,
  onAssignClass,
  onUnassignClass,
  onUpdateReportPermission,
}: Props) {
  // 확장 상태
  const [isClassesExpanded, setIsClassesExpanded] = useState(false);
  const [isFeedExpanded, setIsFeedExpanded] = useState(false);
  
  // 리포트 권한 로컬 상태
  const [canViewReports, setCanViewReports] = useState(teacher.permissions.can_view_reports);
  const [isSavingReportPerm, setIsSavingReportPerm] = useState(false);
  
  // 피드 권한 로컬 상태 (Premium)
  // feedOptionSets 전체를 기준으로 초기화 (기본값 true)
  const [permissionDraft, setPermissionDraft] = useState<Record<string, boolean>>(() => {
    const draft: Record<string, boolean> = {};
    // 1. 모든 옵션셋을 기본값 true로 초기화
    for (const os of feedOptionSets) {
      draft[os.id] = true;
    }
    // 2. 기존 권한 설정으로 덮어쓰기
    for (const p of teacher.feedPermissions) {
      draft[p.option_set_id] = p.is_allowed;
    }
    return draft;
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // 배정 가능한 반 (이미 배정된 반 제외)
  const unassignedClasses = availableClasses.filter(
    (c) => !teacher.assignedClasses.some((ac) => ac.class_id === c.id)
  );

  // 리포트 권한 토글
  const handleToggleReportPermission = async () => {
    const newValue = !canViewReports;
    setCanViewReports(newValue);
    setIsSavingReportPerm(true);
    
    const success = await onUpdateReportPermission(newValue);
    if (!success) {
      setCanViewReports(!newValue);
    }
    setIsSavingReportPerm(false);
  };

  // 피드 권한 토글
  const togglePermission = (optionSetId: string) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [optionSetId]: !prev[optionSetId],
    }));
  };

  // 전체 허용/차단 토글
  const toggleAllPermissions = () => {
    const allEnabled = Object.values(permissionDraft).every(v => v);
    const newValue = !allEnabled;
    const newDraft: Record<string, boolean> = {};
    for (const key of Object.keys(permissionDraft)) {
      newDraft[key] = newValue;
    }
    setPermissionDraft(newDraft);
  };

  // 피드 권한 저장
  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    const permissions = Object.entries(permissionDraft).map(([option_set_id, is_allowed]) => ({
      option_set_id,
      is_allowed,
    }));
    const success = await onSaveFeedPermissions(permissions);
    setIsSavingPermissions(false);
    
    if (success) {
      setIsFeedExpanded(false);
    }
    // 실패 시 패널 열린 상태 유지 (사용자가 재시도 가능)
  };

  // 피드 권한 변경 여부
  const hasPermissionChanges = () => {
    // 기존 권한 변경 확인
    for (const p of teacher.feedPermissions) {
      if (permissionDraft[p.option_set_id] !== p.is_allowed) {
        return true;
      }
    }
    // 신규 옵션셋 확인 (DB에 없지만 draft에 있는 것)
    const existingIds = new Set(teacher.feedPermissions.map(p => p.option_set_id));
    for (const osId of Object.keys(permissionDraft)) {
      if (!existingIds.has(osId)) {
        // 신규인데 false로 변경한 경우만 저장 필요
        if (permissionDraft[osId] === false) {
          return true;
        }
      }
    }
    return false;
  };

  // 피드 권한 요약 텍스트
  const getFeedPermissionSummary = () => {
    const allowedCount = Object.values(permissionDraft).filter(v => v).length;
    const totalCount = Object.keys(permissionDraft).length;
    
    if (totalCount === 0) return '항목 없음';
    if (allowedCount === totalCount) return '전체 허용';
    if (allowedCount === 0) return '전체 차단';
    return `${allowedCount}개 허용`;
  };

  // 허용된 피드 항목 이름들
  const getAllowedFeedNames = () => {
    return feedOptionSets
      .filter(os => permissionDraft[os.id])
      .map(os => os.name);
  };

  const allEnabled = Object.values(permissionDraft).every(v => v);

  return (
    <div className="bg-white rounded-lg border border-[#E8E5E0] h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: teacher.color || '#6366F1' }}
            >
              <span className="text-white font-medium">
                {(teacher.display_name || teacher.name).charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-[#37352F]">
                {teacher.display_name || teacher.name}
              </h2>
              <p className="text-sm text-[#9B9A97]">선생님</p>
            </div>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 설정 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* ========== 색상 (작게) ========== */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#9B9A97]">색상</span>
          <div className="flex gap-1.5">
            {TEACHER_COLORS.map((c) => (
              <button
                key={c.value}
                className={`
                  w-6 h-6 rounded-full transition-all flex items-center justify-center
                  ${teacher.color === c.value 
                    ? 'ring-2 ring-offset-1 ring-[#6366F1]' 
                    : 'hover:scale-110'
                  }
                `}
                style={{ backgroundColor: c.value }}
                onClick={() => onUpdateColor(c.value)}
                title={c.label}
              >
                {teacher.color === c.value && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ========== 담당 학급 (강조) ========== */}
        <div className="p-3 bg-[#F8F8F7] rounded-lg">
          <span className="text-sm font-medium text-[#37352F]">담당 학급</span>
          
          {/* 배정된 반 태그들 + (+) 버튼 */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {teacher.assignedClasses.map((ac) => (
              <span
                key={ac.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg bg-white border border-[#E8E5E0] text-[#37352F] shadow-sm"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: ac.class_color }}
                />
                {ac.class_name}
                <span className="text-xs text-[#9B9A97]">({TEACHER_ROLES[ac.role]})</span>
                <button
                  className="ml-0.5 text-gray-400 hover:text-red-500"
                  onClick={() => onUnassignClass(ac.class_id)}
                  title="배정 해제"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
            
            {/* (+) 버튼 */}
            {unassignedClasses.length > 0 && (
              <button
                onClick={() => setIsClassesExpanded(!isClassesExpanded)}
                className="w-8 h-8 rounded-lg border-2 border-dashed border-[#D1D5DB] text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] hover:bg-white flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            
            {/* 반이 하나도 없을 때 */}
            {teacher.assignedClasses.length === 0 && unassignedClasses.length === 0 && (
              <span className="text-sm text-gray-400">배정 가능한 반 없음</span>
            )}
          </div>

          {/* 확장: 반 선택 드롭다운 */}
          {isClassesExpanded && unassignedClasses.length > 0 && (
            <div className="mt-2 p-2 bg-[#F8F8F7] rounded-lg">
              <div className="space-y-1">
                {unassignedClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cls.color }}
                      />
                      <span className="text-sm text-[#37352F]">{cls.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="px-2 py-0.5 text-xs bg-[#6366F1] text-white rounded hover:bg-[#4F46E5]"
                        onClick={() => {
                          onAssignClass(cls.id, 'primary');
                          if (unassignedClasses.length === 1) setIsClassesExpanded(false);
                        }}
                      >
                        담임
                      </button>
                      <button
                        className="px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        onClick={() => {
                          onAssignClass(cls.id, 'assistant');
                          if (unassignedClasses.length === 1) setIsClassesExpanded(false);
                        }}
                      >
                        보조
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ========== 리포트 조회 ========== */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9B9A97]">리포트 조회</span>
            <button
              onClick={handleToggleReportPermission}
              disabled={isSavingReportPerm}
            >
              <div
                className={`
                  w-11 h-6 rounded-full transition-colors
                  ${canViewReports ? 'bg-[#6366F1]' : 'bg-gray-300'}
                  ${isSavingReportPerm ? 'opacity-50' : ''}
                `}
              >
                <div
                  className={`
                    w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform mt-0.5
                    ${canViewReports ? 'translate-x-5' : 'translate-x-0.5'}
                  `}
                />
              </div>
            </button>
          </div>
        </div>

        {/* ========== 피드 권한 (Premium) ========== */}
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm text-[#9B9A97]">피드 권한</span>
              <Lock className="w-3 h-3 text-[#7C3AED]" />
            </div>
            <button
              onClick={() => setIsFeedExpanded(!isFeedExpanded)}
              className="flex items-center gap-1"
            >
              <span className="text-sm text-[#37352F]">{getFeedPermissionSummary()}</span>
              {isFeedExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
          
          {/* 요약: 허용된 항목들 */}
          {!isFeedExpanded && getAllowedFeedNames().length > 0 && (
            <p className="text-xs text-[#9B9A97] mt-1">
              └ {getAllowedFeedNames().slice(0, 3).join(', ')}
              {getAllowedFeedNames().length > 3 && ` 외 ${getAllowedFeedNames().length - 3}개`}
            </p>
          )}

          {/* 확장: 피드 권한 편집 */}
          {isFeedExpanded && (
            <div className="mt-3 p-3 bg-gradient-to-r from-purple-50/50 to-violet-50/50 border border-[#7C3AED]/20 rounded-lg">
              <p className="text-xs text-[#7C3AED] mb-3">
                선생님별로 입력 가능한 피드 항목을 설정합니다.
              </p>

              {feedOptionSets.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  피드 항목이 없습니다
                </p>
              ) : (
                <div className="space-y-2">
                  {/* 전체 허용 토글 */}
                  <div className="flex items-center justify-between p-2 bg-white/80 rounded-lg">
                    <span className="text-sm font-medium text-[#37352F]">전체 허용</span>
                    <button onClick={toggleAllPermissions}>
                      <div
                        className={`
                          w-10 h-5 rounded-full transition-colors
                          ${allEnabled ? 'bg-[#7C3AED]' : 'bg-gray-300'}
                        `}
                      >
                        <div
                          className={`
                            w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mt-0.5
                            ${allEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                          `}
                        />
                      </div>
                    </button>
                  </div>

                  {/* 개별 항목 */}
                  {feedOptionSets.map((os) => (
                    <div
                      key={os.id}
                      className="flex items-center justify-between p-2"
                    >
                      <span className="text-sm text-[#37352F]">{os.name}</span>
                      <button onClick={() => togglePermission(os.id)}>
                        <div
                          className={`
                            w-10 h-5 rounded-full transition-colors
                            ${permissionDraft[os.id] ?? true ? 'bg-[#7C3AED]' : 'bg-gray-300'}
                          `}
                        >
                          <div
                            className={`
                              w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mt-0.5
                              ${permissionDraft[os.id] ?? true ? 'translate-x-5' : 'translate-x-0.5'}
                            `}
                          />
                        </div>
                      </button>
                    </div>
                  ))}

                  {/* 저장 버튼 */}
                  {hasPermissionChanges() && (
                    <button
                      className="w-full mt-2 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-lg hover:bg-[#6D28D9] disabled:opacity-50"
                      onClick={handleSavePermissions}
                      disabled={isSavingPermissions}
                    >
                      {isSavingPermissions ? '저장 중...' : '변경사항 저장'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
