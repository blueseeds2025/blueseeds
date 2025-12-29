'use client';

import { useState, useCallback } from 'react';
import { MemoField, StudentCardData } from '../types';

interface UseMemoFieldsProps {
  setCardDataMap: React.Dispatch<React.SetStateAction<Record<string, StudentCardData>>>;
}

export function useMemoFields({ setCardDataMap }: UseMemoFieldsProps) {
  const [memoFields, setMemoFields] = useState<MemoField[]>([
    { id: 'default', name: '특이사항', isFixed: true }
  ]);

  const addMemoField = useCallback((name: string) => {
    const newField: MemoField = {
      id: `memo_${Date.now()}`,
      name,
      isFixed: false,
    };
    setMemoFields(prev => [...prev, newField]);
    
    // 모든 카드에 새 메모 필드 추가
    setCardDataMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(studentId => {
        updated[studentId] = {
          ...updated[studentId],
          memoValues: {
            ...updated[studentId].memoValues,
            [newField.id]: '',
          },
        };
      });
      return updated;
    });
  }, [setCardDataMap]);

  const removeMemoField = useCallback((fieldId: string) => {
    setMemoFields(prev => prev.filter(f => f.id !== fieldId));
    
    // 모든 카드에서 해당 메모 필드 제거
    setCardDataMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(studentId => {
        const { [fieldId]: removed, ...rest } = updated[studentId].memoValues;
        updated[studentId] = {
          ...updated[studentId],
          memoValues: rest,
        };
      });
      return updated;
    });
  }, [setCardDataMap]);

  const renameMemoField = useCallback((fieldId: string, newName: string) => {
    setMemoFields(prev => 
      prev.map(f => f.id === fieldId ? { ...f, name: newName } : f)
    );
  }, []);

  return {
    memoFields,
    addMemoField,
    removeMemoField,
    renameMemoField,
  };
}
