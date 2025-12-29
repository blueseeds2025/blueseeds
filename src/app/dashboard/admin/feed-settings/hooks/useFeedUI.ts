'use client';

import { useCallback, useEffect, useState } from 'react';
import { setExpandedSetsCallback } from '../stores/useFeedSettingsStore';

/**
 * 피드 설정 페이지의 UI 전용 상태 관리 훅
 * - expandedSets: 펼쳐진 OptionSet ID들
 * - isEditMode: AI 매핑 편집 모드
 * - 이름 편집 상태
 * - 새 항목 추가 폼 상태
 */
export function useFeedUI() {
  // ========== Expanded Sets ==========
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  // Store와 연결 (Store에서 expand/collapse 호출 시 반영)
  useEffect(() => {
    setExpandedSetsCallback({
      add: (id: string) => {
        setExpandedSets((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      },
      delete: (id: string) => {
        setExpandedSets((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
      clear: () => setExpandedSets(new Set()),
    });

    return () => setExpandedSetsCallback(null);
  }, []);

  const toggleExpand = useCallback((setId: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
      } else {
        next.add(setId);
      }
      return next;
    });
  }, []);

  // ========== Edit Mode ==========
  const [isEditMode, setIsEditMode] = useState(false);

  // ========== Set Name Editing ==========
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState('');

  const startEditingSetName = useCallback((setId: string, currentName: string) => {
    setEditingSetId(setId);
    setEditingSetName(currentName);
  }, []);

  const cancelEditingSetName = useCallback(() => {
    setEditingSetId(null);
    setEditingSetName('');
  }, []);

  // ========== Add Item Form ==========
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<'study' | 'attitude' | 'attendance' | 'none' | null>(null);

  const openAddItemForm = useCallback(() => {
    setIsAddingItem(true);
  }, []);

  const closeAddItemForm = useCallback(() => {
    setIsAddingItem(false);
    setNewItemName('');
    setNewItemCategory(null);
  }, []);

  // ========== Template Modal ==========
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pendingItemName, setPendingItemName] = useState('');

  const openTemplateModal = useCallback((itemName: string) => {
    setPendingItemName(itemName);
    setShowTemplateModal(true);
  }, []);

  const closeTemplateModal = useCallback(() => {
    setShowTemplateModal(false);
    setPendingItemName('');
  }, []);

  // ========== Option Draft (선택지 입력값) ==========
  const [optionDraft, setOptionDraft] = useState<Record<string, string>>({});

  const updateOptionDraft = useCallback((setId: string, value: string) => {
    setOptionDraft((prev) => ({ ...prev, [setId]: value }));
  }, []);

  const clearOptionDraft = useCallback((setId: string) => {
    setOptionDraft((prev) => ({ ...prev, [setId]: '' }));
  }, []);

  // ========== Newly Created Set (강조 표시용) ==========
  const [newlyCreatedSetId, setNewlyCreatedSetId] = useState<string | null>(null);

  const markAsNewlyCreated = useCallback((setId: string) => {
    setNewlyCreatedSetId(setId);
  }, []);

  const clearNewlyCreated = useCallback(() => {
    setNewlyCreatedSetId(null);
  }, []);

  // ========== Return ==========
  return {
    // Expanded Sets
    expandedSets,
    toggleExpand,
    setExpandedSets,

    // Edit Mode
    isEditMode,
    setIsEditMode,

    // Set Name Editing
    editingSetId,
    editingSetName,
    setEditingSetName,
    startEditingSetName,
    cancelEditingSetName,

    // Add Item Form
    isAddingItem,
    newItemName,
    newItemCategory,
    setNewItemName,
    setNewItemCategory,
    openAddItemForm,
    closeAddItemForm,
    setIsAddingItem,

    // Template Modal
    showTemplateModal,
    pendingItemName,
    openTemplateModal,
    closeTemplateModal,
    setShowTemplateModal,
    setPendingItemName,

    // Option Draft
    optionDraft,
    updateOptionDraft,
    clearOptionDraft,

    // Newly Created Set
    newlyCreatedSetId,
    markAsNewlyCreated,
    clearNewlyCreated,
  };
}
