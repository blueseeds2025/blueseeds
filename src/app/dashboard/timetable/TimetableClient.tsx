'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Users, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  getScheduleBlocks, 
  getClassStudentsForBlock,
  createSchedule,
  deleteSchedule,
  getClassesForSchedule,
  ScheduleBlock,
  Teacher 
} from './timetable.actions';
import { toast } from 'sonner';

// ============================================================================
// 상수
// ============================================================================

const DAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
];

const DEFAULT_START_HOUR = 9;   // 기본 시작 시간 (오전 9시)
const DEFAULT_END_HOUR = 23;    // 기본 종료 시간 (오후 11시)
const MIN_HOUR = 6;             // 최소 시작 가능 (오전 6시)
const MAX_HOUR = 24;            // 최대 종료 가능 (자정)
const SLOT_HEIGHT = 48;         // 30분당 픽셀

// 시간 선택 옵션 (30분 단위)
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:00`);
  TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:30`);
}
TIME_OPTIONS.push('24:00'); // 자정

// ============================================================================
// 유틸 함수
// ============================================================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getBlockStyle(startTime: string, endTime: string, startHour: number): React.CSSProperties {
  const startMinutes = timeToMinutes(startTime) - startHour * 60;
  const endMinutes = timeToMinutes(endTime) - startHour * 60;
  const duration = endMinutes - startMinutes;
  
  return {
    top: `${(startMinutes / 30) * SLOT_HEIGHT}px`,
    height: `${(duration / 30) * SLOT_HEIGHT - 4}px`,
  };
}

// ============================================================================
// 메인 컴포넌트
// ============================================================================

export default function TimetableClient() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [userRole, setUserRole] = useState<'owner' | 'teacher'>('teacher');
  const [loading, setLoading] = useState(true);
  const [selectedTeachers, setSelectedTeachers] = useState<Set<string>>(new Set());
  
  // 시간 범위 상태 (동적 조절)
  const [startHour, setStartHour] = useState(DEFAULT_START_HOUR);
  const [endHour, setEndHour] = useState(DEFAULT_END_HOUR);
  
  // 모달 상태
  const [studentModal, setStudentModal] = useState<{
    open: boolean;
    className: string;
    students: { id: string; name: string; displayCode: string }[];
  }>({ open: false, className: '', students: [] });
  
  const [addModal, setAddModal] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; teacherName: string }[]>([]);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    classId: '',
    dayOfWeek: 1,
    startTime: '14:00',
    endTime: '15:00',
  });

  // ============================================================================
  // 데이터 로드
  // ============================================================================

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    const result = await getScheduleBlocks();
    
    if (result.success && result.data) {
      setBlocks(result.data.blocks);
      setTeachers(result.data.teachers);
      setUserRole(result.data.userRole);
      // 기본: 모든 선생님 선택
      setSelectedTeachers(new Set(result.data.teachers.map(t => t.id)));
    } else {
      toast.error(result.error || '시간표를 불러오지 못했습니다');
    }
    
    setLoading(false);
  }

  // ============================================================================
  // 블록 클릭 - 학생 명단 보기
  // ============================================================================

  async function handleBlockClick(block: ScheduleBlock) {
    const result = await getClassStudentsForBlock(block.classId);
    
    if (result.success && result.data) {
      setStudentModal({
        open: true,
        className: result.data.className,
        students: result.data.students,
      });
    } else {
      toast.error(result.error || '학생 목록을 불러오지 못했습니다');
    }
  }

  // ============================================================================
  // 스케줄 추가
  // ============================================================================

  async function openAddModal() {
    const result = await getClassesForSchedule();
    if (result.success && result.data) {
      setClasses(result.data);
      if (result.data.length > 0) {
        setFormData(prev => ({ ...prev, classId: result.data![0].id }));
      }
      setAddModal(true);
    } else {
      toast.error(result.error || '반 목록을 불러오지 못했습니다');
    }
  }

  async function handleAddSchedule() {
    if (!formData.classId) {
      toast.error('반을 선택해주세요');
      return;
    }
    
    const result = await createSchedule(formData);
    
    if (result.success) {
      toast.success('스케줄이 추가되었습니다');
      setAddModal(false);
      loadSchedule();
    } else {
      toast.error(result.error || '스케줄 추가에 실패했습니다');
    }
  }

  // ============================================================================
  // 스케줄 삭제
  // ============================================================================

  async function handleDeleteSchedule(scheduleId: string, e: React.MouseEvent) {
    e.stopPropagation();
    
    if (!confirm('이 스케줄을 삭제하시겠습니까?')) return;
    
    const result = await deleteSchedule(scheduleId);
    
    if (result.success) {
      toast.success('스케줄이 삭제되었습니다');
      loadSchedule();
    } else {
      toast.error(result.error || '스케줄 삭제에 실패했습니다');
    }
  }

  // ============================================================================
  // 선생님 필터
  // ============================================================================

  function toggleTeacher(teacherId: string) {
    setSelectedTeachers(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  }

  function selectAllTeachers() {
    setSelectedTeachers(new Set(teachers.map(t => t.id)));
  }

  // 필터링된 블록
  const filteredBlocks = blocks.filter(b => selectedTeachers.has(b.teacherId));

  // ============================================================================
  // 시간 슬롯 생성 (동적)
  // ============================================================================

  const timeSlots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  // ============================================================================
  // 렌더링
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#111827]">시간표</h1>
        
        {userRole === 'owner' && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] transition-colors"
          >
            <Plus className="w-4 h-4" />
            스케줄 추가
          </button>
        )}
      </div>

      {/* 선생님 필터 (원장만) */}
      {userRole === 'owner' && teachers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-[#F9FAFB] rounded-lg">
          <span className="text-sm text-[#6B7280] mr-2">선생님:</span>
          <button
            onClick={selectAllTeachers}
            className="px-3 py-1 text-xs rounded-full bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]"
          >
            전체
          </button>
          {teachers.map(teacher => (
            <button
              key={teacher.id}
              onClick={() => toggleTeacher(teacher.id)}
              className={`flex items-center gap-2 px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedTeachers.has(teacher.id)
                  ? 'bg-white border-[#6366F1] text-[#6366F1]'
                  : 'bg-[#F3F4F6] border-transparent text-[#9CA3AF]'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: teacher.color }}
              />
              {teacher.name}
            </button>
          ))}
        </div>
      )}

      {/* 시간 범위 조절 */}
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E5E7EB]">
        <div className="flex items-center gap-4">
          {/* 시작 시간 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6B7280]">시작:</span>
            <button
              onClick={() => setStartHour(h => Math.max(MIN_HOUR, h - 1))}
              disabled={startHour <= MIN_HOUR}
              className="w-7 h-7 flex items-center justify-center rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed text-[#374151] font-medium"
            >
              -
            </button>
            <span className="text-sm font-medium text-[#111827] w-12 text-center">
              {startHour.toString().padStart(2, '0')}:00
            </span>
            <button
              onClick={() => setStartHour(h => Math.min(endHour - 1, h + 1))}
              disabled={startHour >= endHour - 1}
              className="w-7 h-7 flex items-center justify-center rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed text-[#374151] font-medium"
            >
              +
            </button>
          </div>
          
          <span className="text-[#D1D5DB]">~</span>
          
          {/* 종료 시간 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6B7280]">종료:</span>
            <button
              onClick={() => setEndHour(h => Math.max(startHour + 1, h - 1))}
              disabled={endHour <= startHour + 1}
              className="w-7 h-7 flex items-center justify-center rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed text-[#374151] font-medium"
            >
              -
            </button>
            <span className="text-sm font-medium text-[#111827] w-12 text-center">
              {endHour.toString().padStart(2, '0')}:00
            </span>
            <button
              onClick={() => setEndHour(h => Math.min(MAX_HOUR, h + 1))}
              disabled={endHour >= MAX_HOUR}
              className="w-7 h-7 flex items-center justify-center rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-30 disabled:cursor-not-allowed text-[#374151] font-medium"
            >
              +
            </button>
          </div>
        </div>
        
        {/* 리셋 버튼 */}
        <button
          onClick={() => {
            setStartHour(DEFAULT_START_HOUR);
            setEndHour(DEFAULT_END_HOUR);
          }}
          className="text-xs text-[#6B7280] hover:text-[#374151] px-2 py-1"
        >
          기본값
        </button>
      </div>

      {/* 시간표 그리드 */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* 요일 헤더 */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#E5E7EB]">
              <div className="p-2 text-center text-xs text-[#9CA3AF] bg-[#F9FAFB]" />
              {DAYS.map(day => (
                <div
                  key={day.value}
                  className="p-3 text-center text-sm font-medium text-[#374151] bg-[#F9FAFB] border-l border-[#E5E7EB]"
                >
                  {day.label}
                </div>
              ))}
            </div>

            {/* 시간 그리드 */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
              {/* 시간 레이블 */}
              <div className="relative">
                {timeSlots.map((time, i) => (
                  <div
                    key={time}
                    className="h-[60px] border-b border-[#F3F4F6] flex items-start justify-center pt-1"
                  >
                    {i % 2 === 0 && (
                      <span className="text-xs text-[#9CA3AF]">{time}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* 요일별 칼럼 */}
              {DAYS.map(day => {
                const dayBlocks = filteredBlocks.filter(b => b.dayOfWeek === day.value);
                
                return (
                  <div
                    key={day.value}
                    className="relative border-l border-[#E5E7EB]"
                    style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}
                  >
                    {/* 배경 그리드 라인 */}
                    {timeSlots.map((_, i) => (
                      <div
                        key={i}
                        className="absolute w-full border-b border-[#F3F4F6]"
                        style={{ top: `${(i + 1) * SLOT_HEIGHT}px` }}
                      />
                    ))}

                    {/* 블록들 */}
                    {dayBlocks.map(block => (
                      <div
                        key={block.id}
                        onClick={() => handleBlockClick(block)}
                        style={{
                          ...getBlockStyle(block.startTime, block.endTime, startHour),
                          borderLeftColor: block.teacherColor,
                        }}
                        className="absolute left-1 right-1 rounded-lg p-2 cursor-pointer 
                                   bg-white border border-[#E5E7EB] border-l-4 shadow-sm
                                   hover:shadow-md hover:border-[#D1D5DB] transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#111827] truncate">
                              {block.className}
                            </p>
                            <p className="text-xs text-[#6B7280] mt-0.5">
                              {block.startTime} - {block.endTime}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-[#9CA3AF]">
                              <Users className="w-3 h-3" />
                              <span>{block.studentCount}명</span>
                            </div>
                          </div>
                          
                          {userRole === 'owner' && (
                            <button
                              onClick={(e) => handleDeleteSchedule(block.id, e)}
                              className="p-1 rounded hover:bg-[#FEE2E2] text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 데이터 없음 */}
      {filteredBlocks.length === 0 && (
        <div className="text-center py-12 text-[#9CA3AF]">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>등록된 스케줄이 없습니다</p>
          {userRole === 'owner' && (
            <button
              onClick={openAddModal}
              className="mt-4 text-[#6366F1] hover:underline"
            >
              + 스케줄 추가하기
            </button>
          )}
        </div>
      )}

      {/* 학생 명단 모달 */}
      {studentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">
                {studentModal.className} 학생 명단
              </h2>
              <button
                onClick={() => setStudentModal({ open: false, className: '', students: [] })}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            
            <div className="p-4 max-h-80 overflow-y-auto">
              {studentModal.students.length === 0 ? (
                <p className="text-center text-[#9CA3AF] py-8">
                  등록된 학생이 없습니다
                </p>
              ) : (
                <ul className="space-y-2">
                  {studentModal.students.map((student, i) => (
                    <li
                      key={student.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#F9FAFB]"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#6366F1] text-white text-xs flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[#374151]">
                        {student.name}
                        {student.displayCode && (
                          <span className="text-[#9CA3AF] ml-1">
                            ({student.displayCode})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="p-4 border-t border-[#E5E7EB]">
              <p className="text-sm text-[#6B7280] text-center">
                총 {studentModal.students.length}명
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 스케줄 추가 모달 */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">
                스케줄 추가
              </h2>
              <button
                onClick={() => setAddModal(false)}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 반 선택 */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  반 선택
                </label>
                <select
                  value={formData.classId}
                  onChange={e => setFormData(prev => ({ ...prev, classId: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.teacherName})
                    </option>
                  ))}
                </select>
              </div>

              {/* 요일 선택 */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  요일
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={e => setFormData(prev => ({ ...prev, dayOfWeek: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
                >
                  {DAYS.map(day => (
                    <option key={day.value} value={day.value}>
                      {day.label}요일
                    </option>
                  ))}
                </select>
              </div>

              {/* 시간 선택 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    시작 시간
                  </label>
                  <select
                    value={formData.startTime}
                    onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
                  >
                    {TIME_OPTIONS.slice(0, -1).map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    종료 시간
                  </label>
                  <select
                    value={formData.endTime}
                    onChange={e => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg focus:ring-2 focus:ring-[#6366F1]/30 focus:border-[#6366F1]"
                  >
                    {TIME_OPTIONS.filter(t => t > formData.startTime).map(time => (
                      <option key={time} value={time}>{time === '24:00' ? '24:00 (자정)' : time}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 border-t border-[#E5E7EB]">
              <button
                onClick={() => setAddModal(false)}
                className="flex-1 px-4 py-2 border border-[#D1D5DB] text-[#374151] rounded-lg hover:bg-[#F9FAFB]"
              >
                취소
              </button>
              <button
                onClick={handleAddSchedule}
                className="flex-1 px-4 py-2 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5]"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
