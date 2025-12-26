'use client';

import { useState, useEffect, useRef } from 'react';
import { FeedOption } from '../types';
import { filterByChosung } from '../constants';

interface FeedBottomSheetProps {
  isOpen: boolean;
  setName: string;
  options: FeedOption[];
  currentValue: string | null;
  onSelect: (optionId: string) => void;
  onClose: () => void;
}

export default function FeedBottomSheet({
  isOpen,
  setName,
  options,
  currentValue,
  onSelect,
  onClose,
}: FeedBottomSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // 열릴 때 검색창 초기화 + 포커스
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      // 약간의 딜레이 후 포커스 (애니메이션 완료 후)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
  // 필터링된 옵션
  const filteredOptions = filterByChosung(options, searchQuery);
  
  // Enter 키 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      // 최상단 항목 선택 (저장 X, 선택만)
      onSelect(filteredOptions[0].id);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  // 옵션 클릭 핸들러
  const handleOptionClick = (optionId: string) => {
    onSelect(optionId);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* 오버레이 */}
      <div 
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      
      {/* 바텀시트 */}
      <div 
        className={`
          fixed bottom-0 left-0 right-0 z-50
          bg-white rounded-t-2xl shadow-xl
          transform transition-transform duration-300 ease-out
          max-h-[70vh] flex flex-col
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* 핸들바 */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* 헤더 */}
        <div className="px-4 pb-2 border-b">
          <h3 className="font-semibold text-lg">{setName}</h3>
        </div>
        
        {/* 검색창 */}
        <div className="p-4 border-b">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              placeholder="검색 (초성 가능: ㅁ → 미흡)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-base
                focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {searchQuery && filteredOptions.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Enter 키로 "{filteredOptions[0].label}" 선택
            </p>
          )}
        </div>
        
        {/* 옵션 리스트 */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto"
        >
          {filteredOptions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              검색 결과가 없습니다
            </div>
          ) : (
            <ul>
              {filteredOptions.map((option, index) => {
                const isSelected = option.id === currentValue;
                const isFirst = index === 0 && searchQuery.length > 0;
                
                return (
                  <li key={option.id}>
                    <button
                      onClick={() => handleOptionClick(option.id)}
                      className={`
                        w-full px-4 py-4 text-left text-base
                        flex items-center justify-between
                        transition-colors
                        ${isSelected 
                          ? 'bg-indigo-50 text-indigo-700' 
                          : isFirst
                            ? 'bg-yellow-50'
                            : 'hover:bg-gray-50'
                        }
                        border-b border-gray-100
                      `}
                    >
                      <span className="flex items-center gap-2">
                        {option.label}
                        {isFirst && (
                          <span className="text-xs text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
                            Enter
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <span className="text-indigo-500">✓</span>
                      )}
                      {option.score !== null && (
                        <span className="text-sm text-gray-400">
                          {option.score}점
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        
        {/* 하단 취소 버튼 */}
        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </>
  );
}
