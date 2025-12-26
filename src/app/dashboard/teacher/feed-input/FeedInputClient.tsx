'use client';

import { useRef, useEffect } from 'react';
import { useFeedInput } from './hooks/useFeedInput';
import { StudentCard, FeedBottomSheet } from './components';
import { calculateGridColumns, getGridClass, formatDisplayDate } from './constants';

export default function FeedInputClient() {
  const {
    classes,
    selectedClassId,
    setSelectedClassId,
    selectedDate,
    setSelectedDate,
    students,
    cardDataMap,
    optionSets,
    tenantSettings,
    bottomSheet,
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetSelect,
    handleAttendanceChange,
    handleNotifyParentChange,
    handleProgressChange,
    handleMemoChange,
    handleSave,
    handleSaveAll,
    isLoading,
    isSaving,
    savingStudentId,
    hasDirtyCards,
    makeupSearch,
    setMakeupSearch,
    makeupResults,
    isSearchingMakeup,
    addMakeupStudent,
  } = useFeedInput();
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 그리드 열 수 계산
  const gridColumns = calculateGridColumns(students.length, 1200); // 기본 1200px 가정
  const gridClass = getGridClass(gridColumns);
  
  // dirty 카드 수
  const dirtyCount = Object.values(cardDataMap).filter(c => c.isDirty || c.status === 'dirty').length;
  
  // 오늘 날짜
  const today = new Date().toISOString().split('T')[0];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 고정 바 */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 날짜 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">날짜</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={today}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              />
              <span className="text-sm text-gray-500">
                {formatDisplayDate(new Date(selectedDate))}
              </span>
            </div>
            
            {/* 반 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">반</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500 min-w-[150px]"
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
            
            {/* 전체 저장 버튼 */}
            <div className="ml-auto">
              <button
                onClick={handleSaveAll}
                disabled={isSaving || dirtyCount === 0}
                className={`
                  px-6 py-2 rounded-lg font-medium transition-all
                  ${dirtyCount > 0
                    ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                {isSaving ? '저장 중...' : `전체 저장 ${dirtyCount > 0 ? `(${dirtyCount})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-6" ref={containerRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4" />
              <p className="text-gray-500">불러오는 중...</p>
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">이 반에 등록된 학생이 없습니다</p>
            <p className="text-gray-400 text-sm mt-2">학생 관리에서 학생을 추가해주세요</p>
          </div>
        ) : (
          <>
            {/* 학생 카드 그리드 */}
            <div className={`grid gap-4 ${gridClass}`}>
              {students.map(student => {
                const cardData = cardDataMap[student.id];
                if (!cardData) return null;
                
                return (
                  <StudentCard
                    key={student.id}
                    data={cardData}
                    optionSets={optionSets}
                    tenantSettings={tenantSettings}
                    onOpenBottomSheet={openBottomSheet}
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
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 flex flex-col items-center justify-center min-h-[200px] bg-white hover:border-purple-400 transition-colors">
                <div className="text-center mb-4">
                  <span className="text-3xl">➕</span>
                  <p className="text-gray-600 mt-2 font-medium">보강생 추가</p>
                </div>
                
                <div className="w-full">
                  <input
                    type="text"
                    placeholder="학생 이름 검색 (2글자 이상)"
                    value={makeupSearch}
                    onChange={(e) => setMakeupSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                  />
                  
                  {isSearchingMakeup && (
                    <p className="text-sm text-gray-500 mt-2 text-center">검색 중...</p>
                  )}
                  
                  {makeupResults.length > 0 && (
                    <ul className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
                      {makeupResults.map(student => (
                        <li key={student.id}>
                          <button
                            onClick={() => addMakeupStudent(student)}
                            className="w-full px-3 py-2 text-left hover:bg-purple-50 transition-colors"
                          >
                            <span className="font-medium">{student.name}</span>
                            <span className="text-sm text-gray-500 ml-2">{student.display_code}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {makeupSearch.length >= 2 && makeupResults.length === 0 && !isSearchingMakeup && (
                    <p className="text-sm text-gray-500 mt-2 text-center">검색 결과가 없습니다</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 바텀시트 */}
      <FeedBottomSheet
        isOpen={bottomSheet.isOpen}
        setName={bottomSheet.setName || ''}
        options={bottomSheet.options}
        currentValue={bottomSheet.currentValue}
        onSelect={handleBottomSheetSelect}
        onClose={closeBottomSheet}
      />
      
      {/* Dirty 상태 경고 (화면 하단) */}
      {hasDirtyCards && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-yellow-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium flex items-center gap-2">
            <span>🟡</span>
            <span>저장하지 않은 변경사항이 있습니다</span>
          </div>
        </div>
      )}
    </div>
  );
}
