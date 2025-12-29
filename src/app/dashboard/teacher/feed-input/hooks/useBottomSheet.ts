'use client';

import { useState, useCallback } from 'react';
import { FeedOptionSet, BottomSheetState, StudentCardData } from '../types';

interface UseBottomSheetProps {
  optionSets: FeedOptionSet[];
  cardDataMap: Record<string, StudentCardData>;
  onSelect: (studentId: string, setId: string, optionId: string) => void;
}

export function useBottomSheet({ optionSets, cardDataMap, onSelect }: UseBottomSheetProps) {
  const [bottomSheet, setBottomSheet] = useState<BottomSheetState>({
    isOpen: false,
    studentId: null,
    setId: null,
    setName: null,
    options: [],
    currentValue: null,
  });

  const openBottomSheet = useCallback((studentId: string, setId: string) => {
    const set = optionSets.find(s => s.id === setId);
    if (!set) return;
    
    const currentValue = cardDataMap[studentId]?.feedValues[setId] || null;
    
    setBottomSheet({
      isOpen: true,
      studentId,
      setId,
      setName: set.name,
      options: set.options,
      currentValue,
    });
  }, [optionSets, cardDataMap]);

  const closeBottomSheet = useCallback(() => {
    setBottomSheet(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleBottomSheetSelect = useCallback((optionId: string) => {
    if (bottomSheet.studentId && bottomSheet.setId) {
      onSelect(bottomSheet.studentId, bottomSheet.setId, optionId);
    }
  }, [bottomSheet.studentId, bottomSheet.setId, onSelect]);

  return {
    bottomSheet,
    openBottomSheet,
    closeBottomSheet,
    handleBottomSheetSelect,
  };
}
