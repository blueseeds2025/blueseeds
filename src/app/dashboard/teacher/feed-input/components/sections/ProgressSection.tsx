'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, X, ChevronDown, Copy, Users } from 'lucide-react';
import type { Textbook, ProgressEntry } from '../../types';

interface ProgressSectionProps {
  studentId: string;
  textbooks: Textbook[];
  progressEntries: ProgressEntry[];
  previousEntries?: ProgressEntry[];
  onProgressChange: (studentId: string, entries: ProgressEntry[]) => void;
  onApplyToAll?: (entries: ProgressEntry[]) => void;
  disabled?: boolean;
}

// ============================================================================
// 한글 초성 검색 유틸
// ============================================================================
const CHOSUNG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

function getChosung(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const chosungIndex = Math.floor((code - 0xAC00) / 588);
      result += CHOSUNG_LIST[chosungIndex];
    } else {
      result += str[i].toLowerCase();
    }
  }
  return result;
}

function matchChosung(text: string, query: string): boolean {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerText.includes(lowerQuery)) return true;
  const textChosung = getChosung(text);
  const queryChosung = getChosung(query);
  return textChosung.includes(queryChosung);
}

// ============================================================================
// 숫자 추출 함수
// ============================================================================
function extractPageNumber(text: string): number | null {
  if (!text) return null;
  const matches = text.match(/(\d+)/g);
  if (!matches || matches.length === 0) return null;
  return parseInt(matches[matches.length - 1], 10);
}

// ============================================================================
// 컴포넌트
// ============================================================================
export default function ProgressSection({
  studentId,
  textbooks,
  progressEntries,
  previousEntries,
  onProgressChange,
  onApplyToAll,
  disabled = false,
}: ProgressSectionProps) {
  // null/undefined 안전하게 처리
  const entries = progressEntries ?? [];
  const prevEntries = previousEntries ?? [];
  const books = textbooks ?? [];
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // 드롭다운 열릴 때 검색 input에 포커스
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isDropdownOpen]);
  
  // 이미 선택된 교재 ID 목록
  const selectedTextbookIds = new Set(entries.map(e => e.textbookId));
  
  // 선택 가능한 교재 (아직 선택 안 된 것들) + 검색 필터
  const availableTextbooks = books
    .filter(t => !selectedTextbookIds.has(t.id))
    .filter(t => matchChosung(t.title, searchQuery));
  
  // 추가 가능한 교재가 있는지
  const hasMoreTextbooks = books.length > entries.length;
  
  // 교재 선택
  function handleSelectTextbook(textbook: Textbook) {
    const newEntry: ProgressEntry = {
      textbookId: textbook.id,
      textbookTitle: textbook.title,
      totalPages: textbook.total_pages,
      endPageInt: null,
      endPageText: '',
    };
    
    const newEntries = [...entries, newEntry];
    onProgressChange(studentId, newEntries);
    setIsDropdownOpen(false);
    setSearchQuery('');
  }
  
  // 교재 삭제
  function handleRemoveEntry(textbookId: string) {
    const newEntries = entries.filter(e => e.textbookId !== textbookId);
    onProgressChange(studentId, newEntries);
  }
  
  // 페이지 입력 변경
  function handlePageChange(textbookId: string, text: string) {
    const pageInt = extractPageNumber(text);
    const newEntries = entries.map(e => 
      e.textbookId === textbookId
        ? { ...e, endPageText: text, endPageInt: pageInt }
        : e
    );
    onProgressChange(studentId, newEntries);
  }
  
  // 전날 값 복사
  function handleCopyPrevious() {
    if (prevEntries.length === 0) return;
    onProgressChange(studentId, [...prevEntries]);
  }
  
  // 이전 진도 표시 텍스트
  function getPreviousText(textbookId: string): string | null {
    const prev = prevEntries.find(e => e.textbookId === textbookId);
    return prev?.endPageText || null;
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-[#6B7280]">
          진도{books.length > 0 && <span className="text-red-500">*</span>}
        </label>
        
        <div className="flex items-center gap-1">
          {/* 전날 값 복사 */}
          {prevEntries.length > 0 && entries.length === 0 && (
            <button
              type="button"
              onClick={handleCopyPrevious}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#6366F1] hover:bg-[#6366F1]/10 rounded transition-colors disabled:opacity-50"
            >
              <Copy className="w-3 h-3" />
              전날 복사
            </button>
          )}
          
          {/* 반 전체 적용 */}
          {onApplyToAll && entries.length > 0 && (
            <button
              type="button"
              onClick={() => onApplyToAll(entries)}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[#10B981] hover:bg-[#10B981]/10 rounded transition-colors disabled:opacity-50"
            >
              <Users className="w-3 h-3" />
              반 전체 적용
            </button>
          )}
        </div>
      </div>
      
      {/* 선택된 교재별 입력 */}
      <div className="space-y-2">
        {entries.map((entry) => {
          const prevText = getPreviousText(entry.textbookId);
          
          return (
            <div
              key={entry.textbookId}
              className="flex items-center gap-2 bg-[#F9FAFB] rounded-lg p-2"
            >
              {/* 교재명 */}
              <div className="flex-shrink-0 min-w-0">
                <span className="text-xs font-medium text-[#6366F1] truncate block max-w-[80px]" title={entry.textbookTitle}>
                  {entry.textbookTitle}
                </span>
                {entry.totalPages && (
                  <span className="text-[10px] text-[#9CA3AF]">
                    /{entry.totalPages}p
                  </span>
                )}
              </div>
              
              {/* 페이지 입력 */}
              <div className="w-28">
                <input
                  type="text"
                  placeholder={prevText || '자유입력'}
                  value={entry.endPageText}
                  onChange={(e) => handlePageChange(entry.textbookId, e.target.value)}
                  disabled={disabled}
                  className={`
                    w-full px-2 py-1.5 text-sm rounded text-[#1F2937] placeholder-[#9CA3AF] bg-white
                    focus:outline-none focus:ring-1 focus:ring-[#6366F1] disabled:bg-[#F3F4F6]
                    ${!entry.endPageText?.trim() ? 'border-red-300 border' : 'border border-[#E5E7EB]'}
                  `}
                />
              </div>
              
              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={() => handleRemoveEntry(entry.textbookId)}
                disabled={disabled}
                className="flex-shrink-0 p-1 text-[#9CA3AF] hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
      
      {/* 교재 추가 드롭다운 */}
      {hasMoreTextbooks && (
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className={`
              flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              ${entries.length === 0
                ? 'text-red-500 border border-red-300 bg-red-50 hover:bg-red-100'
                : 'text-[#6366F1] border border-[#6366F1]/30 hover:bg-[#6366F1]/5'
              }
            `}
          >
            <Plus className="w-3 h-3" />
            교재 추가
            <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute z-20 mt-1 w-56 bg-white border border-[#E5E7EB] rounded-lg shadow-lg overflow-hidden">
              {/* 검색 입력 */}
              <div className="p-2 border-b border-[#E5E7EB]">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="교재 검색 (초성 가능)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-[#E5E7EB] rounded focus:outline-none focus:ring-1 focus:ring-[#6366F1] placeholder-[#9CA3AF]"
                />
              </div>
              
              {/* 교재 목록 */}
              <div className="max-h-40 overflow-y-auto">
                {availableTextbooks.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[#9CA3AF] text-center">
                    {searchQuery ? '검색 결과 없음' : '추가 가능한 교재 없음'}
                  </div>
                ) : (
                  availableTextbooks.map((textbook) => {
                    const hasPrevious = prevEntries.some(e => e.textbookId === textbook.id);
                    
                    return (
                      <button
                        key={textbook.id}
                        type="button"
                        onClick={() => handleSelectTextbook(textbook)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                      >
                        <span className="text-[#1F2937]">{textbook.title}</span>
                        <div className="flex items-center gap-2">
                          {textbook.total_pages && (
                            <span className="text-[10px] text-[#9CA3AF]">{textbook.total_pages}p</span>
                          )}
                          {hasPrevious && (
                            <span className="text-[10px] text-[#6366F1]">이전 기록</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 교재가 없을 때 안내 */}
      {books.length === 0 && (
        <p className="text-xs text-[#9CA3AF]">
          학원 설정에서 교재를 등록해주세요
        </p>
      )}
    </div>
  );
}