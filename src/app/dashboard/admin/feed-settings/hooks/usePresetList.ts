import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { listFeedPresets, applyFeedPreset, deleteFeedPreset } from '../actions/preset.actions';

type PresetSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  setCount: number;
  optionCount: number;
};

type UsePresetListArgs = {
  // TDZ 방지: 반드시 FeedSettingsClient에서 useFeedData보다 위에 선언되어 있어야 함
  getTenantId: () => Promise<string | null>;
  loadOptionSets: () => Promise<void>;

  // localStorage key 함수(너가 컴포넌트 밖에 둔 그 함수)
  presetStorageKey: (tenantId: string) => string;

  // apply 전에 화면 정리(모달 닫기, 입력값 초기화 등) - FeedSettingsClient가 가진 setter를 여기서 콜백으로 받음
  beforeApply?: () => void;
};

export function usePresetList({
  getTenantId,
  loadOptionSets,
  presetStorageKey,
  beforeApply,
}: UsePresetListArgs) {
  const [showPresetListModal, setShowPresetListModal] = useState(false);
  const [presetList, setPresetList] = useState<PresetSummary[]>([]);
  const [isPresetListLoading, setIsPresetListLoading] = useState(false);

  const [applyingPresetId, setApplyingPresetId] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const [lastAppliedPresetName, setLastAppliedPresetName] = useState<string>('');

  const isApplyingPreset = useMemo(() => applyingPresetId !== null, [applyingPresetId]);
  const isDeletingPreset = useMemo(() => deletingPresetId !== null, [deletingPresetId]);

  // ✅ 마지막 적용 프리셋명 localStorage 로드
  useEffect(() => {
    void (async () => {
      const tenantId = await getTenantId();
      if (!tenantId) return;

      const saved = window.localStorage.getItem(presetStorageKey(tenantId));
      if (saved) setLastAppliedPresetName(saved);
    })();
  }, [getTenantId, presetStorageKey]);

  const openPresetList = useCallback(async () => {
    try {
      setIsPresetListLoading(true);
      const data = await listFeedPresets();
      setPresetList(data);
      setShowPresetListModal(true);
    } catch (e) {
      toast.error('저장된 프리셋을 불러오지 못했습니다.');
      console.error(e);
    } finally {
      setIsPresetListLoading(false);
    }
  }, []);

  const handleApplyPreset = useCallback(
    async (presetId: string, presetName: string) => {
      const ok = confirm(
        `⚠️ "${presetName}" 프리셋을 적용할까요?\n\n현재 설정을 나중에 다시 쓰려면, 적용 전에 '기본형 저장'을 눌러 저장해 주세요.`
      );
      if (!ok) return;

      try {
        setApplyingPresetId(presetId);

        // 화면 상태 정리(열려있는 것들 닫기 등)
        beforeApply?.();

        const res = await applyFeedPreset(presetId);
        if (!res?.ok) {
          toast.error(`프리셋 적용 실패: ${res?.message ?? 'UNKNOWN_ERROR'}`);
          return;
        }

        toast.success('프리셋이 적용되었습니다');

        setLastAppliedPresetName(presetName);

        const tenantId = await getTenantId();
        if (tenantId) window.localStorage.setItem(presetStorageKey(tenantId), presetName);

        setShowPresetListModal(false);
        await loadOptionSets();
      } catch (e) {
        toast.error('프리셋 적용에 실패했습니다.');
        console.error(e);
      } finally {
        setApplyingPresetId(null);
      }
    },
    [beforeApply, getTenantId, loadOptionSets, presetStorageKey]
  );

  const handleDeletePreset = useCallback(
    async (presetId: string, presetName: string) => {
      const ok = confirm(`"${presetName}" 프리셋을 삭제할까요?\n\n삭제하면 목록에서 사라지고 복구할 수 없습니다.`);
      if (!ok) return;

      try {
        setDeletingPresetId(presetId);
        await deleteFeedPreset(presetId);

        // 목록 즉시 갱신
        const data = await listFeedPresets();
        setPresetList(data);

        // ✅ 현재 적용된 기본형이 삭제된 프리셋이면 표시/저장값 제거
        if (lastAppliedPresetName === presetName) {
          setLastAppliedPresetName('');

          const tenantId = await getTenantId();
          if (tenantId) {
            window.localStorage.removeItem(presetStorageKey(tenantId));
          }
        }

        toast.success('프리셋이 삭제되었습니다');
      } catch (e) {
        toast.error('프리셋 삭제에 실패했습니다.');
        console.error(e);
      } finally {
        setDeletingPresetId(null);
      }
    },
    [getTenantId, lastAppliedPresetName, presetStorageKey]
  );

  // ✅ 초기화 시 호출할 함수 추가
  const clearLastAppliedPreset = useCallback(async () => {
    setLastAppliedPresetName('');
    
    const tenantId = await getTenantId();
    if (tenantId) {
      window.localStorage.removeItem(presetStorageKey(tenantId));
    }
  }, [getTenantId, presetStorageKey]);

  return {
    // state
    showPresetListModal,
    setShowPresetListModal,
    presetList,
    isPresetListLoading,
    applyingPresetId,
    deletingPresetId,
    isApplyingPreset,
    isDeletingPreset,
    lastAppliedPresetName,

    // actions
    openPresetList,
    handleApplyPreset,
    handleDeletePreset,
    clearLastAppliedPreset, // ✅ 추가
  };
}