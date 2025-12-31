'use client';

import { useState } from 'react';
import type { PeriodPreset } from '@/types/report';
import { PERIOD_PRESETS, getDateRange, formatDateISO } from '../constants';

interface PeriodSelectorProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
}

export function PeriodSelector({ startDate, endDate, onDateChange }: PeriodSelectorProps) {
  const [activePreset, setActivePreset] = useState<PeriodPreset | 'custom'>('2weeks');
  
  const handlePresetClick = (preset: keyof typeof PERIOD_PRESETS) => {
    setActivePreset(preset);
    const { startDate: newStart, endDate: newEnd } = getDateRange(preset);
    onDateChange(newStart, newEnd);
  };
  
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setActivePreset('custom');
    if (type === 'start') {
      onDateChange(value, endDate);
    } else {
      onDateChange(startDate, value);
    }
  };
  
  return (
    <div className="space-y-3">
      {/* 프리셋 버튼 */}
      <div className="flex items-center gap-2">
        {(Object.keys(PERIOD_PRESETS) as Array<keyof typeof PERIOD_PRESETS>).map((key) => (
          <button
            key={key}
            onClick={() => handlePresetClick(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activePreset === key
                ? 'bg-[#6366F1] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {PERIOD_PRESETS[key].label}
          </button>
        ))}
        <button
          onClick={() => setActivePreset('custom')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activePreset === 'custom'
              ? 'bg-[#6366F1] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          직접 선택
        </button>
      </div>
      
      {/* 날짜 입력 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleDateChange('start', e.target.value)}
            max={endDate}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
          />
        </div>
        <span className="text-gray-400">~</span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleDateChange('end', e.target.value)}
            min={startDate}
            max={formatDateISO(new Date())}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );
}