'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Wrench,
  Info,
  Save,
  BookOpen,
  Languages,
  Calculator,
  FolderOpen,
  Trash2,
} from 'lucide-react';

import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';
import BasicSettingsSection from './components/BasicSettingsSection';

import type { ReportCategory } from '@/types/feed-settings';
import { DRAG_ACTIVATION_DISTANCE } from './feedSettings.constants';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { toast } from 'sonner';

import { feedStyles } from '@/styles/feedSettings.styles';

// Hooks
import { useFeedData } from './hooks/useFeedData';
import { usePresetUI } from './hooks/usePresetUI';
import { usePresetList } from './hooks/usePresetList';
import { useConfirmDialog } from './hooks/useConfirmDialog';

// Components
import OptionSetCard from './components/OptionSetCard';
import PresetListModal from './components/PresetListModal';
import PresetSaveModal from './components/PresetSaveModal';
import TemplateSelectModal from './components/TemplateSelectModal';
import AddItemForm from './components/AddItemForm';
import { ScoringWizardModal } from './components/WizardModals';
import MakeupSettingsSection from './components/MakeupSettingsSection';

const presetStorageKey = (tenantId: string) => `feed_last_preset_name:${tenantId}`;

// =======================
// Empty State - 템플릿 선택 화면
// =======================
type EmptyStateProps = {
  onSelectTemplate: (key: 'custom' | 'basic' | 'english' | 'text') => void;
};

function EmptyState({ onSelectTemplate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-2xl font-bold text-[#37352F] mb-2">피드 설정</h1>
      <p className="text-[#9B9A97] mb-8">평가 템플릿을 선택해주세요</p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <Card
          className="cursor-pointer hover:shadow-md transition-all border-[#E8E5E0] hover:border-[#6366F1]"
          onClick={() => onSelectTemplate('custom')}
        >
          <CardContent className="flex flex-col items-center justify-center py-6">
            <Wrench className="w-8 h-8 text-[#6366F1] mb-2" />
            <div className="font-semibold text-[#37352F]">직접 만들기</div>
            <div className="text-sm text-[#9B9A97]">빈 화면</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all border-[#E8E5E0] hover:border-[#059669]"
          onClick={() => onSelectTemplate('basic')}
        >
          <CardContent className="flex flex-col items-center justify-center py-6">
            <BookOpen className="w-8 h-8 text-[#059669] mb-2" />
            <div className="font-semibold text-[#37352F]">기본형</div>
            <div className="text-sm text-[#9B9A97]">종합학원용</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all border-[#E8E5E0] hover:border-[#7C3AED]"
          onClick={() => onSelectTemplate('english')}
        >
          <CardContent className="flex flex-col items-center justify-center py-6">
            <Languages className="w-8 h-8 text-[#7C3AED] mb-2" />
            <div className="font-semibold text-[#37352F]">영어형</div>
            <div className="text-sm text-[#9B9A97]">어학원용</div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-all border-[#E8E5E0] hover:border-[#EA580C]"
          onClick={() => onSelectTemplate('text')}
        >
          <CardContent className="flex flex-col items-center justify-center py-6">
            <Calculator className="w-8 h-8 text-[#EA580C] mb-2" />
            <div className="font-semibold text-[#37352F]">문장형</div>
            <div className="text-sm text-[#9B9A97]">점수 없음</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =======================
// Page
// =======================
export default function FeedSettingsClient() {
  // Supabase client
  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } })
  );

  // =======================
  // Helpers
  // =======================
  const toastLoadFail = () => toast.error('불러오기에 실패했습니다. 잠시 후 다시 시도해주세요.', { duration: 4000 });
  const toastSaveFail = () => toast.error('저장에 실패했습니다. 잠시 후 다시 시도해주세요.', { duration: 4000 });

  // =======================
  // Tenant ID 캐싱
  // =======================
  const [cachedTenantId, setCachedTenantId] = useState<string | null>(null);

  const getTenantId = useCallback(async (): Promise<string | null> => {
    // 이미 캐싱되어 있으면 바로 반환
    if (cachedTenantId) return cachedTenantId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (error || !profile?.tenant_id) return null;
    
    // 캐싱
    setCachedTenantId(profile.tenant_id);
    return profile.tenant_id;
  }, [supabase, cachedTenantId]);

  // =======================
  // UI State
  // =======================
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [optionDraft, setOptionDraft] = useState<Record<string, string>>({});
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingSetName, setEditingSetName] = useState('');
  const [newlyCreatedSetId, setNewlyCreatedSetId] = useState<string | null>(null); // 방금 생성된 세트 ID
  
  // Feature flag state
  const [hasMakeupSystem, setHasMakeupSystem] = useState(false);

  // Add item form state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ReportCategory | null>(null);

  // Template select modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [pendingItemName, setPendingItemName] = useState('');

  // =======================
  // Data Hook
  // =======================
  const {
    activeConfig,
    optionSets,
    options,
    categoryDraft,
    currentTemplate,
    setCurrentTemplate,
    showWizard,
    setShowWizard,
    wizardStep,
    setWizardStep,
    isLoading,
    loadOptionSets,
    handleOptionDragEnd,
    updateOption,
    deleteOption,
    addOptionFromInput,
    toggleSetActive,
    deleteSet,
    updateSetName,
    changeSetCategory,
    duplicateSet,
    applyTemplate,
    setCustomTemplate,
    addItemWithTemplate,
    archiveAllCurrentSets,
  } = useFeedData({
    supabase,
    getTenantId,
    setExpandedSets,
    toastLoadFail,
    toastSaveFail,
  });

  // =======================
  // Preset Hooks
  // =======================
  const {
    showPresetModal,
    setShowPresetModal,
    presetName,
    setPresetName,
    openPresetModal,
    confirmSavePreset,
    isSaving,
  } = usePresetUI(optionSets, options);

  const {
    showPresetListModal,
    setShowPresetListModal,
    presetList,
    applyingPresetId,
    deletingPresetId,
    lastAppliedPresetName,
    openPresetList,
    handleApplyPreset,
    handleDeletePreset,
    clearLastAppliedPreset,
  } = usePresetList({
    getTenantId,
    loadOptionSets,
    presetStorageKey,
    beforeApply: () => {
      setShowWizard(false);
      setShowTemplateModal(false);
      setIsAddingItem(false);
      setShowPresetModal(false);
      setPresetName('');
    },
  });

  // =======================
  // Confirm Dialog
  // =======================
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // =======================
  // Effects
  // =======================
  useEffect(() => {
    setShowPresetModal(false);
    setShowTemplateModal(false);
    setIsAddingItem(false);
    setPresetName('');
    setPendingItemName('');
    setNewItemName('');
    setNewItemCategory(null);
  }, [setShowPresetModal, setPresetName]);

  // Feature flags 로드
  useEffect(() => {
    const loadFeatures = async () => {
      const tenantId = await getTenantId();
      if (!tenantId) return;
      
      const { data: features } = await supabase
        .from('tenant_features')
        .select('feature_key')
        .eq('tenant_id', tenantId)
        .eq('is_enabled', true);
      
      const featureKeys = features?.map(f => f.feature_key) || [];
      setHasMakeupSystem(featureKeys.includes('makeup_system'));
    };
    
    loadFeatures();
  }, [supabase, getTenantId]);

  useEffect(() => {
    if (!showPresetModal) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPresetModal(false);
        setPresetName('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPresetModal, setShowPresetModal, setPresetName]);

  // =======================
  // Handlers
  // =======================
  const handleUpdateSetName = useCallback(
    async (setId: string) => {
      const success = await updateSetName(setId, editingSetName);
      if (success) {
        setEditingSetId(null);
        setEditingSetName('');
      }
    },
    [editingSetName, updateSetName]
  );

  const handleChangeSetCategory = useCallback(
    async (set: typeof optionSets[0], newCategory: ReportCategory) => {
      const success = await changeSetCategory(set, newCategory);
      if (success) {
        setIsEditMode(false);
      }
    },
    [changeSetCategory]
  );

  const handleDuplicateSet = useCallback(
    async (set: typeof optionSets[0]) => {
      const newSet = await duplicateSet(set);
      if (newSet) {
        setEditingSetId(newSet.id);
        setEditingSetName(`${set.name} (복제)`);
      }
    },
    [duplicateSet]
  );

  const handleDeleteSet = useCallback(
    async (set: typeof optionSets[0]) => {
      const ok = await confirm({
        title: '평가항목 삭제',
        description: `"${set.name}" 세트를 삭제할까요?\n\n세트는 보관(archived) 처리되고, 포함된 선택지도 비활성화됩니다.\n\n※ 기존에 기록된 리포트 데이터는 삭제되지 않습니다.`,
        confirmLabel: '삭제',
        variant: 'danger',
      });
      if (!ok) return;

      await deleteSet(set.id);
    },
    [confirm, deleteSet]
  );

  const addNewItem = useCallback(async () => {
    if (!newItemName.trim()) {
      toast.error('평가항목명을 입력하세요');
      return;
    }
    if (!newItemCategory) {
      toast.error('AI 리포트 영역을 먼저 선택해주세요');
      return;
    }
    if (!currentTemplate) {
      setPendingItemName(newItemName);
      setShowTemplateModal(true);
      return;
    }

    const created = await addItemWithTemplate(currentTemplate, newItemName, newItemCategory);
    if (created) {
      setNewItemName('');
      setNewItemCategory(null);
      setIsAddingItem(false);
      setNewlyCreatedSetId(created.id); // 새로 생성된 세트 ID 저장
      
      // 새로 만든 카드로 스크롤
      setTimeout(() => {
        document.getElementById(`option-set-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [addItemWithTemplate, currentTemplate, newItemCategory, newItemName]);

  const handleTemplateSelect = useCallback(
    async (template: 'precise' | 'general' | 'text') => {
      const name = pendingItemName || newItemName;
      const category = newItemCategory;

      if (!name.trim()) {
        toast.error('평가항목명을 입력하세요');
        setShowTemplateModal(false);
        return;
      }
      if (!category) {
        toast.error('AI 리포트 영역을 먼저 선택해주세요');
        setShowTemplateModal(false);
        return;
      }

      const created = await addItemWithTemplate(template, name, category);
      if (created) {
        setPendingItemName('');
        setNewItemName('');
        setNewItemCategory(null);
        setIsAddingItem(false);
        setShowTemplateModal(false);
      }
    },
    [addItemWithTemplate, newItemCategory, newItemName, pendingItemName]
  );

  const toggleExpand = useCallback((setId: string) => {
    setShowPresetListModal(false);
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }, [setShowPresetListModal]);

  const handleResetSettings = useCallback(async () => {
    // 모달로 확인
    const ok = await confirm({
      title: '전체 삭제',
      description: '기존 설정이 모두 삭제(보관)됩니다.\n계속하시겠습니까?',
      confirmLabel: '삭제',
      variant: 'danger',
    });
    if (!ok) return;

    const archived = await archiveAllCurrentSets();
    if (!archived) return;

    // ✅ localStorage에서 마지막 적용 프리셋명 제거
    await clearLastAppliedPreset();

    setShowWizard(false); // EmptyState 보이게
    setIsAddingItem(false);
    setCurrentTemplate(null);
    setNewItemName('');
    setPendingItemName('');
    setNewItemCategory(null);
  }, [archiveAllCurrentSets, clearLastAppliedPreset, confirm, setCurrentTemplate, setShowWizard]);

  const handleCancelAddItem = useCallback(() => {
    setIsAddingItem(false);
    setNewItemName('');
    setNewItemCategory(null);
  }, []);

  // =======================
  // Empty State Handler
  // =======================
  const handleEmptyTemplateSelect = useCallback(
    (key: 'custom' | 'basic' | 'english' | 'text') => {
      if (key === 'custom') {
        // 직접 만들기 → scoring 선택으로
        setShowWizard(true);
        setWizardStep('scoring');
      } else {
        // 템플릿 적용
        void applyTemplate(key);
      }
    },
    [applyTemplate, setShowWizard, setWizardStep]
  );

  // =======================
  // Render
  // =======================

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  // 데이터가 없고, 위저드도 안 보이고, 템플릿도 선택 안 됐으면 EmptyState
  if (optionSets.length === 0 && !showWizard && !currentTemplate) {
    return <EmptyState onSelectTemplate={handleEmptyTemplateSelect} />;
  }

  // 데이터가 있거나 위저드 진행중이면 기존 UI
  return (
    <div className={feedStyles.layout.page}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {/* 좌측: 제목 + 모드 배지 */}
        <div className="flex items-center gap-3">
          <h1 className={feedStyles.text.pageTitle}>피드 설정</h1>
          {currentTemplate && (
            <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded">
              {currentTemplate === 'text'
                ? '문장형'
                : currentTemplate === 'precise'
                ? '5점 단위'
                : '10점 단위'}
            </span>
          )}
        </div>

        {/* 우측: 설정 관리 버튼들 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openPresetModal()}
            className="border-[#E8E5E0] text-[#37352F] hover:bg-[#F7F6F3]"
          >
            <Save className="w-4 h-4 mr-1" />
            내 설정 저장
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openPresetList()}
            className="border-[#E8E5E0] text-[#37352F] hover:bg-[#F7F6F3]"
          >
            <FolderOpen className="w-4 h-4 mr-1" />
            저장된 설정
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetSettings}
            className="border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            전체 삭제
          </Button>
        </div>
      </div>
{/* 평가항목 섹션 */}
      <Card id="feed-option-section" className="mb-6 border-[#E8E5E0]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-[#37352F]">
                평가항목
              </CardTitle>
              <p className="text-sm text-[#9B9A97] mt-1">
                학생 피드에 기록할 평가항목을 설정하세요
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>AI 매핑</span>
              <Switch 
                checked={isEditMode} 
                onCheckedChange={(v) => setIsEditMode(Boolean(v))}
                className="data-[state=checked]:bg-[#6366F1]"
              />
            </div>
          </div>
          {isEditMode && (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#9B9A97]">
              <Info className={feedStyles.icon.small} />
              각 평가항목의 AI 리포트 영역(학습/태도/출결/없음)을 변경할 수 있습니다.
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 평가항목 추가 버튼 */}
          <Button
            onClick={() => {
              setIsAddingItem(true);
              setShowWizard(false);
            }}
            variant="outline"
            className="w-full border border-[#D4D1CC] bg-[#F7F6F3] text-[#5F5E5C] hover:text-[#6366F1] hover:border-[#6366F1] hover:bg-[#EEF2FF]/50"
          >
            <Plus className={feedStyles.icon.buttonIcon} />
            평가항목 추가
          </Button>

          {/* Last applied preset */}
          {lastAppliedPresetName && (
            <div className="text-xs text-[#9B9A97]">
              현재 적용된 기본형: <span className="font-medium text-[#37352F]">{lastAppliedPresetName}</span>
            </div>
          )}

          {/* Add item form */}
          {isAddingItem && (
            <AddItemForm
              currentTemplate={currentTemplate}
              newItemName={newItemName}
              newItemCategory={newItemCategory}
              onChangeName={setNewItemName}
              onChangeCategory={setNewItemCategory}
              onSubmit={() => void addNewItem()}
              onCancel={handleCancelAddItem}
            />
          )}

          {/* Option Sets */}
      {optionSets.map((set) => (
        <OptionSetCard
          key={set.id}
          set={set}
          expanded={expandedSets.has(set.id)}
          isEditMode={isEditMode}
          isHighlightAdd={newlyCreatedSetId === set.id}
          categoryValue={
            (categoryDraft[set.id] ?? set.default_report_category ?? 'study') as ReportCategory
          }
          optionList={options[set.id] ?? []}
          onToggleExpand={() => toggleExpand(set.id)}
          onToggleSetActive={() => void toggleSetActive(set)}
          nameEdit={{
            editing: editingSetId === set.id,
            value: editingSetName,
            onStart: () => {
              setEditingSetId(set.id);
              setEditingSetName(set.name);
            },
            onChange: (v) => setEditingSetName(v),
            onConfirm: () => void handleUpdateSetName(set.id),
            onCancel: () => {
              setEditingSetId(null);
              setEditingSetName('');
            },
          }}
          onDuplicate={() => void handleDuplicateSet(set)}
          onDeleteSet={() => void handleDeleteSet(set)}
          onChangeCategory={(cat) => void handleChangeSetCategory(set, cat)}
          confirm={confirm}
          sensors={sensors}
          onDragEnd={(event) => void handleOptionDragEnd(set.id, event)}
          onDeleteOption={(optionId) => void deleteOption(optionId)}
          onUpdateOption={(optionId, newLabel, newScore) =>
            void updateOption(optionId, newLabel, newScore)
          }
          optionDraft={{
            value: optionDraft[set.id] ?? '',
            onChange: (v) =>
              setOptionDraft((prev) => ({
                ...prev,
                [set.id]: v,
              })),
            onAdd: () => {
              const draft = (optionDraft[set.id] ?? '').trim();
              if (!draft) return;

              // ✅ 입력창 먼저 비우고, 서버 요청은 비동기로
              setOptionDraft((prev) => ({ ...prev, [set.id]: '' }));
              void addOptionFromInput(set.id, draft);
              
              // 옵션 추가하면 강조 해제
              if (newlyCreatedSetId === set.id) {
                setNewlyCreatedSetId(null);
              }
            },
          }}
        />
      ))}
        </CardContent>
      </Card>

      {/* 기본 항목 설정 */}
      <BasicSettingsSection 
        supabase={supabase} 
        getTenantId={getTenantId} 
      />

      {/* 결석/보강 설정 */}
      <MakeupSettingsSection
        supabase={supabase}
        getTenantId={getTenantId}
        hasMakeupSystem={hasMakeupSystem}
        onUpgradeClick={() => {
          // TODO: 업그레이드 안내 모달 또는 페이지로 이동
          toast.info('프리미엄 요금제로 업그레이드하시면 결석/보강 관리 기능을 사용하실 수 있습니다.');
        }}
      />

      {/* Modals */}
      <TemplateSelectModal
        open={showTemplateModal}
        pendingItemName={pendingItemName}
        onSelectPrecise={() => void handleTemplateSelect('precise')}
        onSelectGeneral={() => void handleTemplateSelect('general')}
        onSelectText={() => void handleTemplateSelect('text')}
        onClose={() => {
          setShowTemplateModal(false);
          setPendingItemName('');
        }}
      />

      <PresetSaveModal
        open={showPresetModal}
        presetName={presetName}
        isSaving={isSaving}
        onChangeName={(v) => setPresetName(v)}
        onConfirm={() => void confirmSavePreset()}
        onClose={() => {
          setShowPresetModal(false);
          setPresetName('');
        }}
      />

      <PresetListModal
        open={showPresetListModal}
        onClose={() => setShowPresetListModal(false)}
        presets={presetList}
        applyingPresetId={applyingPresetId}
        deletingPresetId={deletingPresetId}
        onApply={(id, name) => void handleApplyPreset(id, name)}
        onDelete={(id, name) => void handleDeletePreset(id, name)}
      />

      {/* Scoring 선택 모달 */}
      <ScoringWizardModal
        open={showWizard && wizardStep === 'scoring'}
        onBack={() => setShowWizard(false)}
        onSelectScoring={(key) => {
          void setCustomTemplate(key);
          setIsAddingItem(true); // 자동으로 평가항목 추가 폼 열기
        }}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog />
    </div>
  );
}