'use client';

import { useState } from 'react';
import { X, Plus, UserMinus, GraduationCap, Users, Search, Clock, Trash2, ChevronDown, ChevronUp, Palette, ArrowRight } from 'lucide-react';

import type { Class, ClassTeacher, ClassMember, ClassSchedule } from '../types';
import { styles, TEACHER_ROLES, CLASS_COLORS } from '../constants';

const DAY_NAMES: Record<number, string> = {
  0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
};

// 시간 옵션 생성
const HOUR_OPTIONS = Array.from({ length: 15 }, (_, i) => i + 9); // 9~23시
const MINUTE_OPTIONS = [0, 10, 20, 30, 40, 50];

type Props = {
  cls: Class;
  teachers: ClassTeacher[];
  members: ClassMember[];
  schedules: ClassSchedule[];
  availableTeachers: { id: string; name: string; display_name: string }[];
  availableStudents: { id: string; name: string; display_code: string }[];
  allClasses: { id: string; name: string; color: string }[];  // 전체 반 목록 (이동용)
  onClose: () => void;
  onAssignTeacher: (teacherId: string, role: 'primary' | 'assistant') => Promise<boolean>;
  onUnassignTeacher: (teacherId: string) => Promise<boolean>;
  onEnrollStudent: (studentId: string) => Promise<boolean>;
  onUnenrollStudent: (studentId: string) => Promise<boolean>;
  onMoveStudent: (studentId: string, toClassId: string) => Promise<boolean>;  // 학생 이동
  onEnrollStudentsBulk: (studentIds: string[]) => Promise<boolean>;
  onAddSchedulesBulk: (schedules: { dayOfWeek: number; startTime: string; endTime: string }[]) => Promise<boolean>;
  onRemoveSchedule: (scheduleId: string) => Promise<boolean>;
  onDeleteClass: () => void;
  onChangeColor: (color: string) => Promise<boolean>;
};

export function ClassDetailPanel({
  cls,
  teachers,
  members,
  schedules,
  availableTeachers,
  availableStudents,
  allClasses,
  onClose,
  onAssignTeacher,
  onUnassignTeacher,
  onEnrollStudent,
  onUnenrollStudent,
  onMoveStudent,
  onEnrollStudentsBulk,
  onAddSchedulesBulk,
  onRemoveSchedule,
  onDeleteClass,
  onChangeColor,
}: Props) {
  // 아코디언 상태 (기본 전부 펼침)
  const [openSections, setOpenSections] = useState({
    students: true,
    teachers: true,
    schedules: true,
  });
  
  // 추가 폼 상태
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  
  // 학생 이동 상태
  const [movingStudentId, setMovingStudentId] = useState<string | null>(null);
  
  // 스케줄 폼 - 요일 다중 선택
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [startHour, setStartHour] = useState(14);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(15);
  const [endMinute, setEndMinute] = useState(0);

  // 이동 가능한 반 (현재 반 제외)
  const otherClasses = allClasses.filter(c => c.id !== cls.id);

  // 아코디언 토글
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 요일 토글
  const toggleDay = (day: number) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

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

  // 스케줄 일괄 추가
  const handleAddSchedules = async () => {
    if (selectedDays.size === 0) return;
    
    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
    
    const schedules = Array.from(selectedDays).map(dayOfWeek => ({
      dayOfWeek,
      startTime,
      endTime,
    }));
    
    const success = await onAddSchedulesBulk(schedules);
    
    if (success) {
      setSelectedDays(new Set());
      setShowAddSchedule(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-[#E8E5E0] h-full flex flex-col max-h-[calc(100vh-120px)]">
      {/* 헤더 */}
      <div className="p-4 border-b border-[#E8E5E0] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 색깔 버튼 - 클릭하면 팔레트 */}
            <div className="relative group">
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <div
                  className="w-4 h-4 rounded-full border border-gray-200"
                  style={{ backgroundColor: cls.color }}
                />
                <Palette className="w-3.5 h-3.5 text-gray-400" />
              </button>
              
              {/* 툴팁 */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                색상 변경
              </div>
              
              {/* 색상 팔레트 */}
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-[#E8E5E0] p-2 z-20">
                  <div className="grid grid-cols-5 gap-1.5 w-[130px]">
                    {CLASS_COLORS.map((c) => (
                      <button
                        key={c.value}
                        className={`w-5 h-5 rounded-full transition-all ${
                          cls.color === c.value ? 'ring-2 ring-offset-1 ring-[#6366F1]' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.value }}
                        onClick={async () => {
                          await onChangeColor(c.value);
                          setShowColorPicker(false);
                        }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <h2 className="font-semibold text-lg text-[#37352F]">{cls.name}</h2>
          </div>
          <button
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* 스크롤 가능한 컨텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* ========== 학생 섹션 ========== */}
        <div className="border border-[#E8E5E0] rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => toggleSection('students')}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#6366F1]" />
              <span className="font-medium text-[#37352F]">학생</span>
              <span className="text-sm text-gray-500">({members.length})</span>
            </div>
            {openSections.students ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          {openSections.students && (
            <div className="p-3 space-y-2">
              {/* 학생 추가 */}
              {!showAddStudent ? (
                <button
                  className="w-full py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2 text-sm"
                  onClick={() => setShowAddStudent(true)}
                >
                  <Plus className="w-4 h-4" />
                  학생 추가
                </button>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
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

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="학생 이름 검색..."
                      className="w-full pl-9 pr-3 py-2 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                    />
                  </div>

                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {filteredAvailableStudents.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">
                        {availableStudents.length === 0 ? '등록 가능한 학생이 없습니다' : '검색 결과가 없습니다'}
                      </p>
                    ) : (
                      filteredAvailableStudents.map((student) => (
                        <label key={student.id} className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer">
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

                  {selectedStudents.size > 0 && (
                    <button className={styles.button.primary + ' w-full text-sm'} onClick={handleBulkEnroll}>
                      {selectedStudents.size}명 등록
                    </button>
                  )}
                </div>
              )}

              {/* 등록된 학생 목록 */}
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">등록된 학생이 없습니다</p>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-[#37352F]">{member.student?.name ?? '알 수 없음'}</span>
                      <span className="ml-2 text-xs text-gray-400">({member.student?.display_code})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* 반 이동 */}
                      {movingStudentId === member.student_id ? (
                        <div className="flex items-center gap-1">
                          <select
                            className="text-xs border border-gray-200 rounded px-2 py-1"
                            onChange={async (e) => {
                              if (e.target.value) {
                                await onMoveStudent(member.student_id, e.target.value);
                                setMovingStudentId(null);
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="" disabled>이동할 반</option>
                            {otherClasses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="p-1 text-gray-400 hover:text-gray-600"
                            onClick={() => setMovingStudentId(null)}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                            onClick={() => setMovingStudentId(member.student_id)}
                            title="반 이동"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            onClick={() => onUnenrollStudent(member.student_id)}
                            title="반에서 제거"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ========== 교사 섹션 ========== */}
        <div className="border border-[#E8E5E0] rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => toggleSection('teachers')}
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#6366F1]" />
              <span className="font-medium text-[#37352F]">교사</span>
              <span className="text-sm text-gray-500">({teachers.length})</span>
            </div>
            {openSections.teachers ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          {openSections.teachers && (
            <div className="p-3 space-y-2">
              {/* 교사 추가 */}
              {!showAddTeacher ? (
                <button
                  className="w-full py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2 text-sm"
                  onClick={() => setShowAddTeacher(true)}
                >
                  <Plus className="w-4 h-4" />
                  교사 배정
                </button>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">교사 배정</span>
                    <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowAddTeacher(false)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {availableTeachers.filter((t) => !teachers.some((ct) => ct.teacher_id === t.id)).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-2">배정 가능한 교사가 없습니다</p>
                  ) : (
                    availableTeachers
                      .filter((t) => !teachers.some((ct) => ct.teacher_id === t.id))
                      .map((teacher) => (
                        <div key={teacher.id} className="flex items-center justify-between p-2 rounded hover:bg-white">
                          <span className="text-sm text-[#37352F]">{teacher.display_name || teacher.name}</span>
                          <div className="flex gap-1">
                            <button
                              className="px-2 py-1 text-xs bg-[#6366F1] text-white rounded hover:bg-[#4F46E5]"
                              onClick={async () => {
                                const success = await onAssignTeacher(teacher.id, 'primary');
                                if (success) setShowAddTeacher(false);
                              }}
                            >
                              담임
                            </button>
                            <button
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
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
              )}

              {/* 배정된 교사 목록 */}
              {teachers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">배정된 교사가 없습니다</p>
              ) : (
                teachers.map((ct) => (
                  <div key={ct.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#37352F]">
                        {ct.teacher?.display_name || ct.teacher?.name || '알 수 없음'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        ct.role === 'primary' ? 'bg-[#EEF2FF] text-[#6366F1]' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {TEACHER_ROLES[ct.role]}
                      </span>
                    </div>
                    <button
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => onUnassignTeacher(ct.teacher_id)}
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ========== 시간 섹션 ========== */}
        <div className="border border-[#E8E5E0] rounded-lg overflow-hidden">
          <button
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => toggleSection('schedules')}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6366F1]" />
              <span className="font-medium text-[#37352F]">시간</span>
              <span className="text-sm text-gray-500">({schedules.length})</span>
            </div>
            {openSections.schedules ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          {openSections.schedules && (
            <div className="p-3 space-y-2">
              {/* 시간 추가 */}
              {!showAddSchedule ? (
                <button
                  className="w-full py-2 px-3 border-2 border-dashed border-[#E8E5E0] rounded-lg text-[#9B9A97] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex items-center justify-center gap-2 text-sm"
                  onClick={() => setShowAddSchedule(true)}
                >
                  <Plus className="w-4 h-4" />
                  시간 추가
                </button>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">시간 추가</span>
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => {
                        setShowAddSchedule(false);
                        setSelectedDays(new Set());
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 요일 칩 토글 */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">요일 선택</label>
                    <div className="flex flex-wrap gap-1">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                            selectedDays.has(day)
                              ? 'bg-[#6366F1] text-white'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          {DAY_NAMES[day]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 시간 드롭다운 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">시작</label>
                      <div className="flex gap-1">
                        <select
                          value={startHour}
                          onChange={(e) => setStartHour(Number(e.target.value))}
                          className="flex-1 px-2 py-2 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h}시</option>
                          ))}
                        </select>
                        <select
                          value={startMinute}
                          onChange={(e) => setStartMinute(Number(e.target.value))}
                          className="flex-1 px-2 py-2 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">종료</label>
                      <div className="flex gap-1">
                        <select
                          value={endHour}
                          onChange={(e) => setEndHour(Number(e.target.value))}
                          className="flex-1 px-2 py-2 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>{h}시</option>
                          ))}
                        </select>
                        <select
                          value={endMinute}
                          onChange={(e) => setEndMinute(Number(e.target.value))}
                          className="flex-1 px-2 py-2 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 추가 버튼 */}
                  <button
                    className={styles.button.primary + ' w-full text-sm'}
                    onClick={handleAddSchedules}
                    disabled={selectedDays.size === 0}
                  >
                    {selectedDays.size > 0 
                      ? `${Array.from(selectedDays).sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)).map(d => DAY_NAMES[d]).join('/')} 추가`
                      : '요일을 선택하세요'
                    }
                  </button>
                </div>
              )}

              {/* 등록된 시간 목록 */}
              {schedules.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">등록된 시간이 없습니다</p>
              ) : (
                schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-[#6366F1] text-white text-xs rounded font-medium min-w-[28px] text-center">
                        {DAY_NAMES[schedule.dayOfWeek]}
                      </span>
                      <span className="text-sm text-[#37352F]">
                        {schedule.startTime} ~ {schedule.endTime}
                      </span>
                    </div>
                    <button
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      onClick={() => onRemoveSchedule(schedule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ========== 반 삭제 (맨 밑에) ========== */}
        <div className="pt-4 border-t border-[#E8E5E0]">
          <button
            className="w-full py-2 px-3 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
            onClick={onDeleteClass}
          >
            <Trash2 className="w-4 h-4" />
            반 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
