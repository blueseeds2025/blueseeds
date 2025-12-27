'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import StudentCard from './components/StudentCard';
import FeedOptionPicker from './components/FeedOptionPicker';
import { useFeedInput } from './hooks/useFeedInput';
import { formatDisplayDate, getGridClass, calculateGridColumns } from './constants';
import { FeedOption } from './types';

interface FeedInputClientProps {
  initialClasses: { id: string; name: string }[];
  teacherId: string;
  tenantId: string;
}

export default function FeedInputClient({
  initialClasses,
  teacherId,
  tenantId,
}: FeedInputClientProps) {
  const classes = initialClasses || [];
  
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id || '');
  const [gridClass, setGridClass] = useState('grid-cols-3');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 메모 추가 모달
  const [showAddMemo, setShowAddMemo] = useState(false);
  const [newMemoName, setNewMemoName] = useState('');
  
  // 옵션 피커 상태
  const [optionPicker, setOptionPicker] = useState<{
    isOpen: boolean;
    studentId: string | null;
    setId: string | null;
    setName: string | null;
    options: FeedOption[];
    currentValue: string | null;
    anchorEl: HTMLElement | null;
  }>({
    isOpen: false,
    studentId: null,
    setId: null,
    setName: null,
    options: [],
    currentValue: null,
    anchorEl: null,
  });
  
  const {
    students,
    cardDataMap,
    optionSets,
    tenantSettings,
    memoFields,
    isLoading,
    isSaving,
    savingStudentId,
    hasDirtyCards,
    dirtyCount,
    handleAttendanceChange,
    handleNotifyParentChange,
    handleProgressChange,
    handleMemoChange,
    handleFeedValueChange,
    handleSave,
    handleSaveAll,
    addMemoField,
    removeMemoField,
  } = useFeedInput({
    classId: selectedClassId,
    date: selectedDate,
    teacherId,
    tenantId,
  });
  
  // 그리드 컬럼 계산
  useEffect(() => {
    const updateGrid = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const columns = calculateGridColumns(students.length, width);
        setGridClass(getGridClass(columns));
      }
    };
    
    updateGrid();
    window.addEventListener('resize', updateGrid);
    return () => window.removeEventListener('resize', updateGrid);
  }, [students.length]);
  
  // 페이지 이탈 방지
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirtyCards) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDirtyCards]);
  
  // 옵션 피커 열기
  const openOptionPicker = (studentId: string, setId: string, anchorEl: HTMLElement) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    const cardData = cardDataMap[studentId];
    const currentValue = cardData?.feedValues[setId] || null;
    
    setOptionPicker({
      isOpen: true,
      studentId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
      anchorEl,
    });
  };
  
  // 옵션 피커 닫기
  const closeOptionPicker = () => {
    setOptionPicker(prev => ({ ...prev, isOpen: false, anchorEl: null }));
  };
  
  // 옵션 선택
  const handleOptionSelect = (optionId: string) => {
    if (optionPicker.studentId && optionPicker.setId) {
      handleFeedValueChange(optionPicker.studentId, optionPicker.setId, optionId);
    }
  };
  
  // 메모 필드 추가
  const handleAddMemoField = () => {
    if (newMemoName.trim()) {
      addMemoField(newMemoName.trim());
      setNewMemoName('');
      setShowAddMemo(false);
    }
  };
  
  // 보강생 검색
  const [makeupSearch, setMakeupSearch] = useState('');
  const [makeupResults, setMakeupResults] = useState<{ id: string; name: string; display_code: string; hasPendingMakeup?: boolean }[]>([]);
  const [isSearchingMakeup, setIsSearchingMakeup] = useState(false);
  
  useEffect(() => {
    if (makeupSearch.length < 2) {
      setMakeupResults([]);
      return;
    }
    
    const searchStudents = async () => {
      setIsSearchingMakeup(true);
      try {
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        // 1. 보강 대기중인 학생 먼저 조회
        const { data: pendingTickets } = await supabase
          .from('makeup_tickets')
          .select('student_id')
          .eq('status', 'pending');
        
        const pendingStudentIds = new Set(pendingTickets?.map(t => t.student_id) || []);
        
        // 2. 학생 검색
        const { data } = await supabase
          .from('students')
          .select('id, name, display_code')
          .eq('tenant_id', tenantId)
          .ilike('name', `%${makeupSearch}%`)
          .limit(10);
        
        const existingIds = students.map(s => s.id);
        const filtered = (data || [])
          .filter(s => !existingIds.includes(s.id))
          .map(s => ({
            ...s,
            hasPendingMakeup: pendingStudentIds.has(s.id),
          }))
          // 보강 필요 학생 먼저 정렬
          .sort((a, b) => {
            if (a.hasPendingMakeup && !b.hasPendingMakeup) return -1;
            if (!a.hasPendingMakeup && b.hasPendingMakeup) return 1;
            return 0;
          });
        
        setMakeupResults(filtered);
      } finally {
        setIsSearchingMakeup(false);
      }
    };
    
    const debounce = setTimeout(searchStudents, 300);
    return () => clearTimeout(debounce);
  }, [makeupSearch, tenantId, students]);
  
  const addMakeupStudent = (student: { id: string; name: string; display_code: string }) => {
    // TODO: 보강생 추가 로직
    toast.success(`${student.name} 보강생 추가됨`);
    setMakeupSearch('');
    setMakeupResults([]);
  };
  
  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* 상단 고정 바 */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#6B7280]">날짜</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={today}
                className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
              />
              <span className="text-sm text-[#6B7280]">
                {formatDisplayDate(new Date(selectedDate))}
              </span>
            </div>
            
            {/* 반 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#6B7280]">반</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30 min-w-[150px]"
              >
                {classes.length === 0 ? (
                  <option value="">담당 반이 없습니다</option>
                ) : (
                  classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))
                )}
              </select>
            </div>
            
            {/* 메모 추가 버튼 */}
            <button
              onClick={() => setShowAddMemo(true)}
              className="px-3 py-2 border border-dashed border-[#D1D5DB] rounded-lg text-sm text-[#6B7280] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
            >
              + 메모 추가
            </button>
            
            {/* 전체 저장 버튼 */}
            <div className="ml-auto">
              <button
                onClick={handleSaveAll}
                disabled={isSaving || dirtyCount === 0}
                className={`
                  px-6 py-2 rounded-lg font-medium transition-all
                  ${dirtyCount > 0
                    ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white'
                    : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
                  }
                `}
              >
                {isSaving ? '저장 중...' : `전체 저장 ${dirtyCount > 0 ? `(${dirtyCount})` : ''}`}
              </button>
            </div>
          </div>
          
          {/* 추가된 메모 필드 태그들 */}
          {memoFields.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-[#E5E7EB]">
              <span className="text-xs text-[#6B7280]">메모 항목:</span>
              {memoFields.map((field, idx) => (
                <span 
                  key={field.id} 
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium
                    ${idx === 0 
                      ? 'bg-[#F3F4F6] text-[#6B7280]' 
                      : 'bg-[#EEF2FF] text-[#6366F1]'
                    }
                  `}
                >
                  {field.name}
                  {idx > 0 && (
                    <button
                      onClick={() => removeMemoField(field.id)}
                      className="ml-1.5 text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 메모 추가 모달 */}
      {showAddMemo && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowAddMemo(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl p-6 w-80">
            <h3 className="font-semibold text-lg text-[#1F2937] mb-4">메모 항목 추가</h3>
            <input
              type="text"
              placeholder="항목 이름 (예: 준비물, 알림장)"
              value={newMemoName}
              onChange={(e) => setNewMemoName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemoField()}
              autoFocus
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg mb-4 text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddMemo(false)}
                className="flex-1 px-4 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#1F2937] rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddMemoField}
                disabled={!newMemoName.trim()}
                className="flex-1 px-4 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                추가
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#6366F1] border-t-transparent mx-auto mb-4" />
              <p className="text-[#6B7280]">불러오는 중...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#6B7280] text-lg">이 반에 등록된 학생이 없습니다</p>
            <p className="text-[#9CA3AF] text-sm mt-2">학생 관리에서 학생을 추가해주세요</p>
          </div>
        ) : (
          <>
            {/* 학생 카드 그리드 */}
            <div className={`grid gap-3 ${gridClass}`}>
              {students.map(student => {
                const cardData = cardDataMap[student.id];
                if (!cardData) return null;
                
                return (
                  <StudentCard
                    key={student.id}
                    data={cardData}
                    optionSets={optionSets}
                    tenantSettings={tenantSettings}
                    memoFields={memoFields}
                    onOpenOptionPicker={openOptionPicker}
                    onAttendanceChange={handleAttendanceChange}
                    onNotifyParentChange={handleNotifyParentChange}
                    onProgressChange={handleProgressChange}
                    onMemoChange={handleMemoChange}
                    onSave={handleSave}
                    isSaving={savingStudentId === student.id}
                  />
                );
              })}
              
              {/* 보강생 추가 카드 */}
              <div 
                className="rounded-xl p-3 flex flex-col items-center justify-center min-h-[160px] bg-white/80 hover:bg-[#FAF5FF] transition-all"
                style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
              >
                <div className="text-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#F3E8FF] flex items-center justify-center mx-auto mb-1.5">
                    <span className="text-[#7C3AED] text-lg font-bold">+</span>
                  </div>
                  <p className="text-[#6B7280] font-semibold text-sm">보강생 추가</p>
                </div>
                
                <div className="w-full">
                  <input
                    type="text"
                    placeholder="학생 이름 검색 (2글자 이상)"
                    value={makeupSearch}
                    onChange={(e) => setMakeupSearch(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[#E5E7EB] rounded text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
                  />
                  
                  {isSearchingMakeup && (
                    <p className="text-xs text-[#9CA3AF] mt-1.5 text-center">검색 중...</p>
                  )}
                  
                  {makeupResults.length > 0 && (
                    <ul className="mt-1.5 border border-[#E5E7EB] rounded divide-y divide-[#F3F4F6] max-h-32 overflow-y-auto bg-white">
                      {makeupResults.map(student => (
                        <li key={student.id}>
                          <button
                            onClick={() => addMakeupStudent(student)}
                            className={`w-full px-2 py-1.5 text-left hover:bg-[#FAF5FF] transition-colors text-sm ${
                              student.hasPendingMakeup ? 'bg-[#FEF3C7]' : ''
                            }`}
                          >
                            <span className="font-semibold text-[#1F2937]">{student.name}</span>
                            <span className="text-[#9CA3AF] ml-1.5 text-xs">{student.display_code}</span>
                            {student.hasPendingMakeup && (
                              <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-[#F59E0B] text-white rounded">
                                보강필요
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {makeupSearch.length >= 2 && makeupResults.length === 0 && !isSearchingMakeup && (
                    <p className="text-xs text-[#9CA3AF] mt-1.5 text-center">검색 결과 없음</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 옵션 피커 (PC: 팝오버 / 모바일: 바텀시트) */}
      <FeedOptionPicker
        isOpen={optionPicker.isOpen}
        setName={optionPicker.setName || ''}
        options={optionPicker.options}
        currentValue={optionPicker.currentValue}
        anchorEl={optionPicker.anchorEl}
        onSelect={handleOptionSelect}
        onClose={closeOptionPicker}
      />
      
      {/* Dirty 상태 경고 */}
      {hasDirtyCards && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-[#F59E0B] text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>저장하지 않은 변경사항이 있습니다</span>
          </div>
        </div>
      )}
    </div>
  );
}