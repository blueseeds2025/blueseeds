'use client';

import { useState } from 'react';
import { X, Plus, Trash2, School, FileText, Palette, Check } from 'lucide-react';

import type { TeacherWithDetails, ClassInfo, FeedOptionSet } from '../types';
import { TEACHER_COLORS, TEACHER_ROLES, styles } from '../constants';

type Props = {
  teacher: TeacherWithDetails;
  availableClasses: ClassInfo[];
  feedOptionSets: FeedOptionSet[];
  onClose: () => void;
  onUpdateColor: (color: string) => Promise<boolean>;
  onSaveFeedPermissions: (permissions: { option_set_id: string; is_allowed: boolean }[]) => Promise<boolean>;
  onAssignClass: (classId: string, role: 'primary' | 'assistant') => Promise<boolean>;
  onUnassignClass: (classId: string) => Promise<boolean>;
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
}: Props) {
  const [activeTab, setActiveTab] = useState<'classes' | 'permissions' | 'color'>('classes');
  const [showAddClass, setShowAddClass] = useState(false);
  
  // 피드 권한 로컬 상태
  const [permissionDraft, setPermissionDraft] = useState<Record<string, boolean>>(() => {
    const draft: Record<string, boolean> = {};
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

  // 권한 토글
  const togglePermission = (optionSetId: string) => {
    setPermissionDraft((prev) => ({
      ...prev,
      [optionSetId]: !prev[optionSetId],
    }));
  };

  // 권한 저장
  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    const permissions = Object.entries(permissionDraft).map(([option_set_id, is_allowed]) => ({
      option_set_id,
      is_allowed,
    }));
    await onSaveFeedPermissions(permissions);
    setIsSavingPermissions(false);
  };

  // 변경 여부 체크
  const hasPermissionChanges = () => {
    for (const p of teacher.feedPermissions) {
      if (permissionDraft[p.option_set_id] !== p.is_allowed) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="bg-white rounded-lg border border-[#E8E5E0] h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
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
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            className={`
              flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'classes' 
                ? 'bg-white text-[#37352F] shadow-sm' 
                : 'text-gray-500 hover:text-[#37352F]'
              }
            `}
            onClick={() => setActiveTab('classes')}
          >
            <School className="w-4 h-4" />
            담당 반
          </button>
          <button
            className={`
              flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'permissions' 
                ? 'bg-white text-[#37352F] shadow-sm' 
                : 'text-gray-500 hover:text-[#37352F]'
              }
            `}
            onClick={() => setActiveTab('permissions')}
          >
            <FileText className="w-4 h-4" />
            피드 항목
          </button>
          <button
            className={`
              flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'color' 
                ? 'bg-white text-[#37352F] shadow-sm' 
                : 'text-gray-500 hover:text-[#37352F]'
              }
            `}
            onClick={() => setActiveTab('color')}
          >
            <Palette className="w-4 h-4" />
            색상
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 담당 반 탭 */}
        {activeTab === 'classes' && (
          <div>
            {/* 반 추가 버튼 */}
            {!showAddClass ? (
              <button
                className="w-full mb-4 py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2"
                onClick={() => setShowAddClass(true)}
              >
                <Plus className="w-4 h-4" />
                반 배정
              </button>
            ) : (
              /* 반 추가 폼 */
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">반 배정</span>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => setShowAddClass(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {unassignedClasses.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    배정 가능한 반이 없습니다
                  </p>
                ) : (
                  <div className="space-y-1">
                    {unassignedClasses.map((cls) => (
                      <div
                        key={cls.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cls.color }}
                          />
                          <span className="text-sm text-[#37352F]">{cls.name}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            className="px-2 py-1 text-xs bg-[#6366F1] text-white rounded hover:bg-[#4F46E5] transition-colors"
                            onClick={async () => {
                              const success = await onAssignClass(cls.id, 'primary');
                              if (success) setShowAddClass(false);
                            }}
                          >
                            담임
                          </button>
                          <button
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                            onClick={async () => {
                              const success = await onAssignClass(cls.id, 'assistant');
                              if (success) setShowAddClass(false);
                            }}
                          >
                            보조
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 배정된 반 목록 */}
            {teacher.assignedClasses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                배정된 반이 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {teacher.assignedClasses.map((ac) => (
                  <div
                    key={ac.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: ac.class_color }}
                      />
                      <span className="text-sm font-medium text-[#37352F]">
                        {ac.class_name}
                      </span>
                      <span
                        className={`
                          px-2 py-0.5 text-xs rounded-full
                          ${ac.role === 'primary' 
                            ? 'bg-[#EEF2FF] text-[#6366F1]' 
                            : 'bg-gray-100 text-gray-600'
                          }
                        `}
                      >
                        {TEACHER_ROLES[ac.role]}
                      </span>
                    </div>
                    <button
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => onUnassignClass(ac.class_id)}
                      title="배정 해제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 피드 항목 권한 탭 */}
        {activeTab === 'permissions' && (
          <div>
            <p className="text-sm text-[#9B9A97] mb-4">
              이 선생님이 입력할 수 있는 피드 항목을 선택하세요.
            </p>

            {feedOptionSets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                피드 항목이 없습니다. 먼저 피드 설정에서 항목을 추가하세요.
              </p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {feedOptionSets.map((os) => (
                    <label
                      key={os.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-sm font-medium text-[#37352F]">
                        {os.name}
                      </span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={permissionDraft[os.id] ?? true}
                          onChange={() => togglePermission(os.id)}
                          className="sr-only"
                        />
                        <div
                          className={`
                            w-10 h-6 rounded-full transition-colors
                            ${permissionDraft[os.id] ?? true 
                              ? 'bg-[#6366F1]' 
                              : 'bg-gray-300'
                            }
                          `}
                        >
                          <div
                            className={`
                              w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mt-1
                              ${permissionDraft[os.id] ?? true 
                                ? 'translate-x-5' 
                                : 'translate-x-1'
                              }
                            `}
                          />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* 저장 버튼 */}
                {hasPermissionChanges() && (
                  <button
                    className={styles.button.primary + ' w-full'}
                    onClick={handleSavePermissions}
                    disabled={isSavingPermissions}
                  >
                    {isSavingPermissions ? '저장 중...' : '변경사항 저장'}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* 색상 탭 */}
        {activeTab === 'color' && (
          <div>
            <p className="text-sm text-[#9B9A97] mb-4">
              시간표에 표시될 색상을 선택하세요.
            </p>

            <div className="grid grid-cols-6 gap-2">
              {TEACHER_COLORS.map((c) => (
                <button
                  key={c.value}
                  className={`
                    w-10 h-10 rounded-full transition-all flex items-center justify-center
                    ${teacher.color === c.value 
                      ? 'ring-2 ring-offset-2 ring-[#6366F1] scale-110' 
                      : 'hover:scale-105'
                    }
                  `}
                  style={{ backgroundColor: c.value }}
                  onClick={() => onUpdateColor(c.value)}
                  title={c.label}
                >
                  {teacher.color === c.value && (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
