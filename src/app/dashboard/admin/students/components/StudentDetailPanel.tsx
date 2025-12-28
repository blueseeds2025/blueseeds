'use client';

import { useState } from 'react';
import { 
  X, 
  Plus, 
  Edit2, 
  UserMinus, 
  UserPlus,
  Trash2,
  School,
  Phone,
  FileText,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  User,
} from 'lucide-react';

import type { StudentWithDetails, ClassInfo } from '../types';
import { gradeToText } from '../types';
import { styles } from '../constants';

type Props = {
  student: StudentWithDetails;
  availableClasses: ClassInfo[];
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onEnrollToClass: (classId: string) => Promise<boolean>;
  onUnenrollFromClass: (classId: string) => Promise<boolean>;
  onMoveToClass: (fromClassId: string, toClassId: string) => Promise<boolean>;
};

export function StudentDetailPanel({
  student,
  availableClasses,
  onClose,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  onEnrollToClass,
  onUnenrollFromClass,
  onMoveToClass,
}: Props) {
  const [showAddClass, setShowAddClass] = useState(false);
  const [moveFromClassId, setMoveFromClassId] = useState<string | null>(null);
  
  // 로딩 및 성공 상태
  const [enrollingClassId, setEnrollingClassId] = useState<string | null>(null);
  const [enrolledClassId, setEnrolledClassId] = useState<string | null>(null);
  const [unenrollingClassId, setUnenrollingClassId] = useState<string | null>(null);

  // 현재 등록된 반 ID 목록
  const enrolledClassIds = new Set(
    student.enrollments.filter(e => e.is_active).map(e => e.class_id)
  );

  // 등록 가능한 반 (현재 미등록)
  const unenrolledClasses = availableClasses.filter(c => !enrolledClassIds.has(c.id));

  // 반 등록 핸들러 (로딩 + 성공 애니메이션)
  const handleEnrollToClass = async (classId: string) => {
    setEnrollingClassId(classId);
    const success = await onEnrollToClass(classId);
    setEnrollingClassId(null);
    
    if (success) {
      setEnrolledClassId(classId);
      setTimeout(() => {
        setEnrolledClassId(null);
        setShowAddClass(false);
      }, 800);
    }
  };

  // 반 제거 핸들러
  const handleUnenrollFromClass = async (classId: string) => {
    setUnenrollingClassId(classId);
    await onUnenrollFromClass(classId);
    setUnenrollingClassId(null);
  };

  return (
    <div className="bg-white rounded-lg border border-[#E8E5E0] h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-lg text-[#37352F]">{student.name}</h2>
            <span className={student.is_active ? styles.badge.active : styles.badge.inactive}>
              {student.is_active ? '재원' : '퇴원'}
            </span>
          </div>
          <button
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 기본 정보 */}
        <section>
          <h3 className="text-sm font-medium text-[#37352F] mb-3">기본 정보</h3>
          <div className="space-y-2">
            {/* 학교/학년 */}
            <div className="flex items-center gap-3 text-sm">
              <School className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {student.school || '-'} / {gradeToText(student.grade)}
              </span>
            </div>
            {/* 보호자 연락처 */}
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-400 text-xs mr-2">보호자</span>
                {(student.parent_phone || student.phone) ? (
                  <a href={`tel:${student.parent_phone || student.phone}`} className="text-[#6366F1] hover:underline">
                    {student.parent_phone || student.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
            {/* 학생 연락처 */}
            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <span className="text-gray-400 text-xs mr-2">학생</span>
                {student.student_phone ? (
                  <a href={`tel:${student.student_phone}`} className="text-[#6366F1] hover:underline">
                    {student.student_phone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
            {/* 주소 */}
            {student.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{student.address}</span>
              </div>
            )}
          </div>
        </section>

        {/* 학생 특이사항 */}
        {student.memo && (
          <section>
            <h3 className="text-sm font-medium text-[#37352F] mb-2">학생 특이사항</h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{student.memo}</p>
            </div>
          </section>
        )}

        {/* 수강 반 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[#37352F]">
              수강 반 ({student.currentClassCount})
            </h3>
          </div>

          {/* 반 추가 버튼 */}
          {!showAddClass ? (
            <button
              className="w-full mb-3 py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2"
              onClick={() => setShowAddClass(true)}
            >
              <Plus className="w-4 h-4" />
              반 추가
            </button>
          ) : (
            /* 반 추가 폼 */
            <div className="mb-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">반 선택</span>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  onClick={() => setShowAddClass(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-2">클릭하면 바로 등록됩니다</p>
              
              {unenrolledClasses.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">
                  등록 가능한 반이 없습니다
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {unenrolledClasses.map((cls) => {
                    const isEnrolling = enrollingClassId === cls.id;
                    const isEnrolled = enrolledClassId === cls.id;
                    
                    return (
                      <button
                        key={cls.id}
                        className={`
                          w-full flex items-center justify-between p-2 rounded text-left transition-all
                          ${isEnrolled 
                            ? 'bg-green-100 text-green-700' 
                            : 'hover:bg-white'
                          }
                        `}
                        onClick={() => handleEnrollToClass(cls.id)}
                        disabled={isEnrolling || isEnrolled}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: cls.color }}
                          />
                          <span className="text-sm">{cls.name}</span>
                        </div>
                        
                        {isEnrolling && (
                          <Loader2 className="w-4 h-4 animate-spin text-[#6366F1]" />
                        )}
                        {isEnrolled && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="w-4 h-4" />
                            <span className="text-xs">등록됨</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 등록된 반 목록 */}
          {student.enrollments.filter(e => e.is_active).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              등록된 반이 없습니다
            </p>
          ) : (
            <div className="space-y-2">
              {student.enrollments
                .filter(e => e.is_active)
                .map((enrollment) => {
                  const isUnenrolling = unenrollingClassId === enrollment.class_id;
                  
                  return (
                    <div
                      key={enrollment.id}
                      className={`
                        flex items-center justify-between p-3 rounded-lg transition-all
                        ${isUnenrolling ? 'bg-red-50 opacity-50' : 'bg-gray-50'}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: enrollment.class_color }}
                        />
                        <span className="text-sm font-medium text-[#37352F]">
                          {enrollment.class_name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {/* 반 이동 */}
                        {moveFromClassId === enrollment.class_id ? (
                          <div className="flex items-center gap-1">
                            <select
                              className="text-xs border border-gray-200 rounded px-2 py-1"
                              onChange={async (e) => {
                                if (e.target.value) {
                                  await onMoveToClass(enrollment.class_id, e.target.value);
                                  setMoveFromClassId(null);
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>이동할 반 선택</option>
                              {unenrolledClasses.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                  {cls.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="p-1 text-gray-400 hover:text-gray-600"
                              onClick={() => setMoveFromClassId(null)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                              onClick={() => setMoveFromClassId(enrollment.class_id)}
                              title="반 이동"
                              disabled={isUnenrolling}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                              onClick={() => handleUnenrollFromClass(enrollment.class_id)}
                              title="반에서 제거"
                              disabled={isUnenrolling}
                            >
                              {isUnenrolling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserMinus className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* 수강 이력 (비활성 상태) */}
        {student.enrollments.some(e => !e.is_active) && (
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-3">이전 수강 이력</h3>
            <div className="space-y-1">
              {student.enrollments
                .filter(e => !e.is_active)
                .map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center gap-2 p-2 text-sm text-gray-400"
                  >
                    <div
                      className="w-2 h-2 rounded-full opacity-50"
                      style={{ backgroundColor: enrollment.class_color }}
                    />
                    <span>{enrollment.class_name}</span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>

      {/* 푸터 - 액션 버튼 */}
      <div className="p-4 border-t border-[#E8E5E0]">
        <div className="flex gap-2">
          <button
            className={styles.button.secondary + ' flex-1 flex items-center justify-center gap-1'}
            onClick={onEdit}
          >
            <Edit2 className="w-4 h-4" />
            정보 수정
          </button>
          
          {student.is_active ? (
            <button
              className="flex-1 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium flex items-center justify-center gap-1"
              onClick={onArchive}
            >
              <UserMinus className="w-4 h-4" />
              퇴원
            </button>
          ) : (
            <button
              className="flex-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium flex items-center justify-center gap-1"
              onClick={onRestore}
            >
              <UserPlus className="w-4 h-4" />
              재원
            </button>
          )}
          
          <button
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            onClick={onDelete}
            title="삭제"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
