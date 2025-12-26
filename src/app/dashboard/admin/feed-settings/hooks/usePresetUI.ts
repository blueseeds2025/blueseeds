'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { saveFeedPreset } from '../actions/preset.actions';
import type { OptionSet, Option } from '@/types/feed-settings';

export function usePresetUI(
  optionSets: OptionSet[],
  options: Record<string, Option[]>
) {
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const openPresetModal = useCallback(() => {
    setPresetName('');
    setShowPresetModal(true);
  }, []);

  const confirmSavePreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name) {
      toast.error('프리셋 이름을 입력하세요');
      return;
    }

    if (optionSets.length === 0) {
      toast.error('저장할 평가항목이 없습니다');
      return;
    }

    try {
      setIsSaving(true);

      const result = await saveFeedPreset({
        name,
        optionSets,
        optionsBySet: options,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success('프리셋이 저장되었습니다');
      setShowPresetModal(false);
      setPresetName('');
    } catch (e) {
      console.error('[confirmSavePreset] error:', e);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  }, [presetName, optionSets, options]);

  return {
    showPresetModal,
    setShowPresetModal,
    presetName,
    setPresetName,
    openPresetModal,
    confirmSavePreset,
    isSaving,
  };
}