'use client';

import { useState } from 'react';
import { X, Plus, UserMinus, GraduationCap, Users, Search } from 'lucide-react';

import type { Class, ClassTeacher, ClassMember } from '../types';
import { styles, TEACHER_ROLES } from '../constants';

type Props = {
  cls: Class;
  teachers: ClassTeacher[];
  members: ClassMember[];
  availableTeachers: { id: string; name: string; display_name: string }[];
  availableStudents: { id: string; name: string; display_code: string }[];
  onClose: () => void;
  onAssignTeacher: (teacherId: string, role: 'primary' | 'assistant') => Promise<boolean>;
  onUnassignTeacher: (teacherId: string) => Promise<boolean>;
  onEnrollStudent: (studentId: string) => Promise<boolean>;
  onUnenrollStudent: (studentId: string) => Promise<boolean>;
  onEnrollStudentsBulk: (studentIds: string[]) => Promise<boolean>;
};

export function ClassDetailPanel({
  cls,
  teachers,
  members,
  availableTeachers,
  availableStudents,
  onClose,
  onAssignTeacher,
  onUnassignTeacher,
  onEnrollStudent,
  onUnenrollStudent,
  onEnrollStudentsBulk,
}: Props) {
  const [activeTab, setActiveTab] = useState<'teachers' | 'students'>('students');
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // 학생 필터링
  const filteredAvailableStudents = availableStudents.filter((s) =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.display_code.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // 학생 선택 토글
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // 선택된 학생 일괄 등록
  const handleBulkEnroll = async () => {
    if (selectedStudents.size === 0) return;
    const success = await onEnrollStudentsBulk(Array.from(selectedStudents));
    if (success) {
      setSelectedStudents(new Set());
      setShowAddStudent(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E8E5E0] h-full flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: cls.color }}
            />
            <h2 className="font-semibold text-lg text-[#37352F]">{cls.name}</h2>
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
              ${activeTab === 'students' 
                ? 'bg-white text-[#37352F] shadow-sm' 
                : 'text-gray-500 hover:text-[#37352F]'
              }
            `}
            onClick={() => setActiveTab('students')}
          >
            <Users className="w-4 h-4" />
            학생 ({members.length})
          </button>
          <button
            className={`
              flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2
              ${activeTab === 'teachers' 
                ? 'bg-white text-[#37352F] shadow-sm' 
                : 'text-gray-500 hover:text-[#37352F]'
              }
            `}
            onClick={() => setActiveTab('teachers')}
          >
            <GraduationCap className="w-4 h-4" />
            교사 ({teachers.length})
          </button>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 학생 탭 */}
        {activeTab === 'students' && (
          <div>
            {/* 학생 추가 버튼 */}
            {!showAddStudent ? (
              <button
                className="w-full mb-4 py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2"
                onClick={() => setShowAddStudent(true)}
              >
                <Plus className="w-4 h-4" />
                학생 추가
              </button>
            ) : (
              /* 학생 추가 폼 */
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">학생 추가</span>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      setShowAddStudent(false);
                      setSelectedStudents(new Set());
                      setStudentSearch('');
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 검색 */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="학생 이름 검색..."
                    className="w-full pl-9 pr-3 py-2 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>

                {/* 학생 목록 */}
                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                  {filteredAvailableStudents.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      {availableStudents.length === 0 
                        ? '등록 가능한 학생이 없습니다' 
                        : '검색 결과가 없습니다'
                      }
                    </p>
                  ) : (
                    filteredAvailableStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="rounded border-gray-300 text-[#6366F1] focus:ring-[#6366F1]"
                        />
                        <span className="text-sm text-[#37352F]">{student.name}</span>
                        <span className="text-xs text-gray-400">({student.display_code})</span>
                      </label>
                    ))
                  )}
                </div>

                {/* 일괄 등록 버튼 */}
                {selectedStudents.size > 0 && (
                  <button
                    className={styles.button.primary + ' w-full text-sm'}
                    onClick={handleBulkEnroll}
                  >
                    {selectedStudents.size}명 등록
                  </button>
                )}
              </div>
            )}

            {/* 등록된 학생 목록 */}
            {members.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                등록된 학생이 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <span className="text-sm font-medium text-[#37352F]">
                        {member.student?.name ?? '알 수 없음'}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        ({member.student?.display_code})
                      </span>
                    </div>
                    <button
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => onUnenrollStudent(member.student_id)}
                      title="등록 해제"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 교사 탭 */}
        {activeTab === 'teachers' && (
          <div>
            {/* 교사 추가 버튼 */}
            {!showAddTeacher ? (
              <button
                className="w-full mb-4 py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2"
                onClick={() => setShowAddTeacher(true)}
              >
                <Plus className="w-4 h-4" />
                교사 배정
              </button>
            ) : (
              /* 교사 배정 폼 */
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">교사 배정</span>
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => setShowAddTeacher(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 배정 가능한 교사 목록 */}
                <div className="space-y-1">
                  {availableTeachers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      배정 가능한 교사가 없습니다
                    </p>
                  ) : (
                    availableTeachers
                      .filter((t) => !teachers.some((ct) => ct.teacher_id === t.id))
                      .map((teacher) => (
                        <div
                          key={teacher.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-white"
                        >
                          <span className="text-sm text-[#37352F]">
                            {teacher.display_name || teacher.name}
                          </span>
                          <div className="flex gap-1">
                            <button
                              className="px-2 py-1 text-xs bg-[#6366F1] text-white rounded hover:bg-[#4F46E5] transition-colors"
                              onClick={async () => {
                                const success = await onAssignTeacher(teacher.id, 'primary');
                                if (success) setShowAddTeacher(false);
                              }}
                            >
                              담임
                            </button>
                            <button
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                              onClick={async () => {
                                const success = await onAssignTeacher(teacher.id, 'assistant');
                                if (success) setShowAddTeacher(false);
                              }}
                            >
                              보조
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* 배정된 교사 목록 */}
            {teachers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                배정된 교사가 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {teachers.map((ct) => (
                  <div
                    key={ct.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#37352F]">
                        {ct.teacher?.display_name || ct.teacher?.name || '알 수 없음'}
                      </span>
                      <span
                        className={`
                          px-2 py-0.5 text-xs rounded-full
                          ${ct.role === 'primary' 
                            ? 'bg-[#EEF2FF] text-[#6366F1]' 
                            : 'bg-gray-100 text-gray-600'
                          }
                        `}
                      >
                        {TEACHER_ROLES[ct.role]}
                      </span>
                    </div>
                    <button
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => onUnassignTeacher(ct.teacher_id)}
                      title="배정 해제"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
