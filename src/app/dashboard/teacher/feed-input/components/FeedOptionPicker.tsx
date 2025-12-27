'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FeedOption } from '../types';
import { filterByChosung } from '../constants';

interface FeedOptionPickerProps {
  isOpen: boolean;
  setName: string;
  options: FeedOption[];
  currentValue: string | null;
  anchorEl: HTMLElement | null;
  onSelect: (optionId: string) => void;
  onClose: () => void;
}

export default function FeedOptionPicker({
  isOpen,
  setName,
  options,
  currentValue,
  anchorEl,
  onSelect,
  onClose,
}: FeedOptionPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 클라이언트 마운트 체크
  useEffect(() => {
    setMounted(true);
  }, []);

  // 모바일 체크
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 팝오버 위치 계산 - 버튼 바로 아래에 붙이기
  useEffect(() => {
    if (!isMobile && anchorEl && isOpen) {
      const rect = anchorEl.getBoundingClientRect();
      
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }
  }, [anchorEl, isOpen, isMobile]);

  // 열릴 때 초기화 + 포커스
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // 바깥 클릭 감지 (PC)
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile, onClose]);

  const filteredOptions = filterByChosung(options, searchQuery);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      onSelect(filteredOptions[0].id);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleOptionClick = (optionId: string) => {
    onSelect(optionId);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  // 옵션 리스트 공통 UI
  const OptionList = (
    <>
      {/* 검색창 */}
      <div className="p-3 border-b border-[#E5E7EB]">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="검색 (초성 가능)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
          />
        </div>
        {searchQuery && filteredOptions.length > 0 && (
          <p className="text-xs text-[#9CA3AF] mt-1">
            Enter → <span className="text-[#6366F1] font-medium">{filteredOptions[0].label}</span>
          </p>
        )}
      </div>

      {/* 옵션 리스트 */}
      <div className="max-h-[240px] overflow-y-auto">
        {filteredOptions.length === 0 ? (
          <div className="p-4 text-center text-[#9CA3AF] text-sm">검색 결과 없음</div>
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
                      w-full px-4 py-3 text-left text-sm flex items-center justify-between
                      transition-colors border-b border-[#F3F4F6]
                      ${isSelected ? 'bg-[#EEF2FF] text-[#6366F1]' : isFirst ? 'bg-[#FFFBEB]' : 'hover:bg-[#F9FAFB]'}
                    `}
                  >
                    <span className="flex items-center gap-2">
                      {option.label}
                      {isFirst && (
                        <span className="text-[10px] text-[#F59E0B] bg-[#FEF3C7] px-1.5 py-0.5 rounded font-medium">
                          Enter
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      {option.score !== null && (
                        <span className="text-xs text-[#9CA3AF]">{option.score}점</span>
                      )}
                      {isSelected && <span className="text-[#6366F1] font-bold">✓</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );

  // 모바일: 바텀시트
  if (isMobile) {
    return createPortal(
      <>
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[70vh] flex flex-col"
          style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.15)' }}
        >
          {/* 핸들바 */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-[#D1D5DB] rounded-full" />
          </div>
          {/* 헤더 */}
          <div className="px-4 pb-2 border-b border-[#E5E7EB]">
            <h3 className="font-semibold text-lg text-[#1F2937]">{setName}</h3>
          </div>
          {OptionList}
          {/* 취소 버튼 */}
          <div className="p-3 border-t border-[#E5E7EB]">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#1F2937] rounded-lg font-medium"
            >
              취소
            </button>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // PC: 드롭다운 (버튼 바로 아래)
  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={popoverRef}
        className="fixed z-50 bg-white rounded-lg border border-[#E5E7EB] overflow-hidden"
        style={{
          top: position.top,
          left: position.left,
          width: position.width,
          maxHeight: '300px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        }}
      >
        {OptionList}
      </div>
    </>,
    document.body
  );
}
