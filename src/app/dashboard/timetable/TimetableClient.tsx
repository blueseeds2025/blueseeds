'use client';

import { useState, useEffect, DragEvent } from 'react';
import { X, Clock } from 'lucide-react';
import { 
  getScheduleBlocks, 
  moveStudentThisDay,
  moveStudentWholeGroup,
  ScheduleBlock,
  Teacher,
  Student
} from './timetable.actions';
import { toast } from 'sonner';

// ============================================================================
// 상수
// ============================================================================

const DAYS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

const DAY_NAMES: Record<number, string> = {
  0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
};

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 23;
const MIN_HOUR = 6;
const MAX_HOUR = 24;
const SLOT_HEIGHT = 48;

// 기본 선택 요일 (월~금)
const DEFAULT_SELECTED_DAYS = new Set([1, 2, 3, 4, 5]);

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
// 드래그 데이터 타입
// ============================================================================

interface DragData {
  student: Student;
  fromBlock: ScheduleBlock;
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
  
  const [startHour, setStartHour] = useState(DEFAULT_START_HOUR);
  const [endHour, setEndHour] = useState(DEFAULT_END_HOUR);
  
  // 요일 선택 상태
  const [selectedDays, setSelectedDays] = useState<Set<number>>(DEFAULT_SELECTED_DAYS);
  
  // 드래그 상태
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  
  // 블록 확장 상태
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  
  // 변경 확인 모달
  const [moveModal, setMoveModal] = useState<{
    open: boolean;
    student: Student | null;
    fromBlock: ScheduleBlock | null;
    toBlock: ScheduleBlock | null;
  }>({ open: false, student: null, fromBlock: null, toBlock: null });
  const [isMoving, setIsMoving] = useState(false);

  // ============================================================================
  // 데이터 로드
  // ============================================================================

  useEffect(() => {
    loadSchedule();
  }, []);

  // 바깥 클릭 시 확장 블록 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // 확장된 블록 외부 클릭 시 닫기
      if (expandedBlockId && !target.closest('[data-block-expanded]')) {
        setExpandedBlockId(null);
      }
    }
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [expandedBlockId]);

  async function loadSchedule() {
    setLoading(true);
    const result = await getScheduleBlocks();
    
    if (result.success && result.data) {
      setBlocks(result.data.blocks);
      setTeachers(result.data.teachers);
      setUserRole(result.data.userRole);
      setSelectedTeachers(new Set(result.data.teachers.map(t => t.id)));
    } else {
      toast.error(result.error || '시간표를 불러오지 못했습니다');
    }
    
    setLoading(false);
  }

  // 요일 토글
  function toggleDay(day: number) {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) {
        // 최소 1개는 선택되어야 함
        if (next.size > 1) {
          next.delete(day);
        }
      } else {
        next.add(day);
      }
      return next;
    });
  }

  // 선택된 요일만 필터
  const visibleDays = DAYS.filter(d => selectedDays.has(d.value));

  // ============================================================================
  // 드래그 앤 드롭 핸들러
  // ============================================================================

  function handleDragStart(e: DragEvent, student: Student, block: ScheduleBlock) {
    setDragData({ student, fromBlock: block });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', student.id);
  }

  function handleDragEnd() {
    setDragData(null);
    setDropTarget(null);
  }

  function handleDragOver(e: DragEvent, blockId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(blockId);
  }

  function handleDragLeave() {
    setDropTarget(null);
  }

  function handleDrop(e: DragEvent, toBlock: ScheduleBlock) {
    e.preventDefault();
    setDropTarget(null);
    
    if (!dragData) return;
    
    // 같은 블록에 드롭하면 무시
    if (dragData.fromBlock.id === toBlock.id) {
      setDragData(null);
      return;
    }
    
    // 확인 모달 열기
    setMoveModal({
      open: true,
      student: dragData.student,
      fromBlock: dragData.fromBlock,
      toBlock: toBlock,
    });
    
    setDragData(null);
  }

  // ============================================================================
  // 변경 실행
  // ============================================================================

  async function handleMoveThisDay() {
    if (!moveModal.student || !moveModal.toBlock) return;
    
    setIsMoving(true);
    const targetBlockId = moveModal.toBlock.id;
    
    const result = await moveStudentThisDay(
      moveModal.student.assignmentId,
      moveModal.toBlock.id
    );
    
    if (result.success) {
      toast.success(
        `${moveModal.student.name}: ${DAY_NAMES[moveModal.fromBlock!.dayOfWeek]}요일 ${moveModal.fromBlock!.startTime} → ${moveModal.toBlock.startTime} 변경 완료`
      );
      setMoveModal({ open: false, student: null, fromBlock: null, toBlock: null });
      await loadSchedule();
      // 이동 완료 후 목적지 블록 포커스
      setExpandedBlockId(targetBlockId);
    } else {
      toast.error(result.error || '변경에 실패했습니다');
    }
    
    setIsMoving(false);
  }

  async function handleMoveWholeGroup() {
    if (!moveModal.student || !moveModal.toBlock) return;
    
    setIsMoving(true);
    const targetBlockId = moveModal.toBlock.id;
    
    const result = await moveStudentWholeGroup(
      moveModal.student.assignmentId,
      moveModal.toBlock.id
    );
    
    if (result.success) {
      const movedDayNames = (result.movedDays || []).map(d => DAY_NAMES[d]).join(', ');
      const skippedDayNames = (result.skippedDays || []).map(d => DAY_NAMES[d]).join(', ');
      
      if (result.skippedDays && result.skippedDays.length > 0) {
        toast.success(
          `${moveModal.student.name}: ${movedDayNames} 변경 완료 (${skippedDayNames}은 슬롯 없어서 유지)`
        );
      } else {
        toast.success(`${moveModal.student.name}: ${movedDayNames} 전체 변경 완료`);
      }
      
      setMoveModal({ open: false, student: null, fromBlock: null, toBlock: null });
      await loadSchedule();
      // 이동 완료 후 목적지 블록 포커스
      setExpandedBlockId(targetBlockId);
    } else {
      toast.error(result.error || '변경에 실패했습니다');
    }
    
    setIsMoving(false);
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

  const filteredBlocks = blocks.filter(b => selectedTeachers.has(b.teacherId));

  // ============================================================================
  // 시간 슬롯
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

      {/* 요일 선택 + 시간 범위 조절 */}
      <div className="flex flex-col gap-2">
        {/* 요일 선택 */}
        <div className="flex items-center gap-2 p-3 bg-white rounded-lg border border-[#E5E7EB]">
          <span className="text-sm text-[#6B7280] mr-2">요일:</span>
          {DAYS.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={`w-8 h-8 text-sm font-medium rounded-full transition-colors ${
                selectedDays.has(day.value)
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        {/* 시간 범위 조절 */}
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#E5E7EB]">
          <div className="flex items-center gap-4">
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
          
          <button
            onClick={() => {
              setStartHour(DEFAULT_START_HOUR);
              setEndHour(DEFAULT_END_HOUR);
              setSelectedDays(DEFAULT_SELECTED_DAYS);
            }}
            className="text-xs text-[#6B7280] hover:text-[#374151] px-2 py-1"
          >
            기본값
          </button>
        </div>
      </div>

      {/* 시간표 그리드 */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[400px]">
            {/* 요일 헤더 */}
            <div 
              className="grid border-b border-[#E5E7EB]"
              style={{ gridTemplateColumns: `80px repeat(${visibleDays.length}, 1fr)` }}
            >
              <div className="p-2 text-center text-xs text-[#9CA3AF] bg-[#F9FAFB]" />
              {visibleDays.map(day => (
                <div
                  key={day.value}
                  className="p-3 text-center text-sm font-medium text-[#374151] bg-[#F9FAFB] border-l border-[#E5E7EB]"
                >
                  {day.label}
                </div>
              ))}
            </div>

            {/* 시간 그리드 */}
            <div 
              className="grid"
              style={{ gridTemplateColumns: `80px repeat(${visibleDays.length}, 1fr)` }}
            >
              {/* 시간 레이블 */}
              <div className="relative">
                {timeSlots.map((time, i) => (
                  <div
                    key={time}
                    className={`h-[48px] flex items-start justify-end pr-3 pt-1
                      ${i % 2 === 0 ? 'border-b border-[#D1D5DB]' : 'border-b border-[#F3F4F6]'}`}
                  >
                    <span className={`${i % 2 === 0 ? 'text-base text-[#374151] font-semibold' : 'text-sm text-[#9CA3AF]'}`}>
                      {time}
                    </span>
                  </div>
                ))}
              </div>

              {/* 요일별 칼럼 */}
              {visibleDays.map(day => {
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
                        className={`absolute w-full border-b ${i % 2 === 1 ? 'border-[#D1D5DB]' : 'border-[#F3F4F6]'}`}
                        style={{ top: `${(i + 1) * SLOT_HEIGHT}px` }}
                      />
                    ))}

                    {/* 블록들 */}
                    {dayBlocks.map(block => {
                      const isExpanded = expandedBlockId === block.id;
                      const baseStyle = getBlockStyle(block.startTime, block.endTime, startHour);
                      
                      return (
                        <div
                          key={block.id}
                          data-block-expanded={isExpanded || undefined}
                          onDragOver={(e) => handleDragOver(e, block.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, block)}
                          onClick={(e) => {
                            // 클릭으로 확장/축소 (owner, teacher 모두)
                            e.stopPropagation();
                            setExpandedBlockId(isExpanded ? null : block.id);
                          }}
                          style={{
                            ...baseStyle,
                            borderLeftColor: block.teacherColor,
                            // 확장 시 높이 auto + z-index 높임
                            ...(isExpanded ? { 
                              height: 'auto', 
                              minHeight: baseStyle.height,
                              zIndex: 50,
                            } : {}),
                          }}
                          className={`absolute left-1 right-1 rounded-lg p-2
                                     bg-white border border-l-4 shadow-sm
                                     transition-all cursor-pointer hover:shadow-md
                                     ${isExpanded ? 'overflow-visible shadow-lg' : 'overflow-hidden'}
                                     ${dropTarget === block.id 
                                       ? 'border-[#6366F1] bg-[#EEF2FF] shadow-md' 
                                       : 'border-[#E5E7EB]'
                                     }`}
                        >
                          {/* 반 이름 */}
                          <p className="text-sm font-medium text-[#111827] truncate">
                            {block.className}
                            {block.students.length > 0 && (
                              <span className="ml-1 text-xs text-[#9CA3AF]">
                                ({block.students.length}명)
                              </span>
                            )}
                          </p>
                          
                          {/* 학생 목록 */}
                          {isExpanded ? (
                            // 확장 모드: 전체 학생 표시 + 드래그 가능
                            block.students.length === 0 ? (
                              <p className="text-xs text-[#9CA3AF] mt-1">학생 없음</p>
                            ) : (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {block.students.map(student => (
                                  <span
                                    key={student.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, student, block)}
                                    onDragEnd={handleDragEnd}
                                    className={`text-xs px-1.5 py-0.5 rounded cursor-grab active:cursor-grabbing
                                               transition-colors select-none
                                               ${dragData?.student.id === student.id
                                                 ? 'bg-[#6366F1] text-white'
                                                 : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                                               }`}
                                  >
                                    {student.name}
                                  </span>
                                ))}
                              </div>
                            )
                          ) : (
                            // 축소 모드: teacher만 콤마 나열, owner는 인원수만
                            userRole === 'teacher' && block.students.length > 0 && (
                              <p className="text-xs text-[#6B7280] truncate">
                                {block.students.map(s => s.name).join(', ')}
                              </p>
                            )
                          )}
                        </div>
                      );
                    })}
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
          <p className="text-sm mt-1">반 관리에서 시간표를 설정해주세요</p>
        </div>
      )}

      {/* 변경 확인 모달 */}
      {moveModal.open && moveModal.student && moveModal.fromBlock && moveModal.toBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#111827]">
                학생 변경
              </h2>
              <button
                onClick={() => setMoveModal({ open: false, student: null, fromBlock: null, toBlock: null })}
                className="p-2 rounded-lg hover:bg-[#F3F4F6]"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 변경 정보 */}
              <div className="bg-[#F9FAFB] rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-[#111827]">
                  {moveModal.student.name}
                </p>
                <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                  <span>{moveModal.fromBlock.className}</span>
                  <span>→</span>
                  <span className="text-[#6366F1] font-medium">{moveModal.toBlock.className}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                  <span>{DAY_NAMES[moveModal.fromBlock.dayOfWeek]} {moveModal.fromBlock.startTime}</span>
                  <span>→</span>
                  <span>{DAY_NAMES[moveModal.toBlock.dayOfWeek]} {moveModal.toBlock.startTime}</span>
                </div>
              </div>
              
              {/* 그룹 정보 */}
              {moveModal.student.groupKey && (
                <p className="text-xs text-[#9CA3AF] text-center">
                  그룹: {moveModal.student.groupKey}
                </p>
              )}
            </div>
            
            <div className="flex flex-col gap-2 p-4 border-t border-[#E5E7EB]">
              <button
                onClick={handleMoveThisDay}
                disabled={isMoving}
                className="w-full px-4 py-2.5 bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] disabled:opacity-50 font-medium"
              >
                {isMoving ? '변경 중...' : `${DAY_NAMES[moveModal.fromBlock.dayOfWeek]}요일만 변경`}
              </button>
              
              {moveModal.student.groupKey && (
                <button
                  onClick={handleMoveWholeGroup}
                  disabled={isMoving}
                  className="w-full px-4 py-2.5 border border-[#6366F1] text-[#6366F1] rounded-lg hover:bg-[#EEF2FF] disabled:opacity-50 font-medium"
                >
                  {isMoving ? '변경 중...' : '모든 요일 변경'}
                </button>
              )}
              
              <button
                onClick={() => setMoveModal({ open: false, student: null, fromBlock: null, toBlock: null })}
                disabled={isMoving}
                className="w-full px-4 py-2 text-[#6B7280] hover:text-[#374151]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}