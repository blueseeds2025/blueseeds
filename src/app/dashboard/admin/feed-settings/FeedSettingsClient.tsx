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
import { toast } from 'sonner';

import type { Database } from '@/lib/supabase/types';
import type { ReportCategory } from '@/types/feed-settings';

import { DRAG_ACTIVATION_DISTANCE } from './feedSettings.constants';
import { feedStyles } from '@/styles/feedSettings.styles';

// UI Components
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Page Components
import BasicSettingsSection from './components/BasicSettingsSection';
import MakeupSettingsSection from './components/MakeupSettingsSection';
import OptionSetCard from './components/OptionSetCard';
import PresetListModal from './components/PresetListModal';
import PresetSaveModal from './components/PresetSaveModal';
import TemplateSelectModal from './components/TemplateSelectModal';
import AddItemForm from './components/AddItemForm';
import { ScoringWizardModal } from './components/WizardModals';

// Store & Hooks
import { useFeedSettingsStore } from './stores/useFeedSettingsStore';
// Note: Zustand 설치 필요 - npm install zustand
import { useFeedUI } from './hooks/useFeedUI';
import { usePresetUI } from './hooks/usePresetUI';
import { usePresetList } from './hooks/usePresetList';
import { useConfirmDialog } from './hooks/useConfirmDialog';

// Server Actions
import {
  getTenantSettings,
  updateBasicSettings,
  updateMakeupSettings,
  type BasicSettings,
} from './actions/feed-settings.actions';

// ============================================================================
// Constants
// ============================================================================

const presetStorageKey = (tenantId: string) => `feed_last_preset_name:${tenantId}`;

// ============================================================================
// Empty State Component
// ============================================================================

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

// ============================================================================
// Main Component
// ============================================================================

export default function FeedSettingsClient() {
  // ========== Supabase & DnD ==========
  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } })
  );

  // ========== Store ==========
  const {
    optionSets,
    options,
    categoryDraft,
    currentTemplate,
    isLoading,
    showWizard,
    wizardStep,
    loadData,
    toggleSetActive,
    deleteSet,
    updateSetName,
    changeSetCategory,
    duplicateSet,
    handleOptionDragEnd,
    updateOption,
    deleteOption,
    addOptionFromInput,
    archiveAllCurrentSets,
    applyTemplate,
    setCustomTemplate,
    addItemWithTemplate,
    setShowWizard,
    setWizardStep,
    setCurrentTemplate,
  } = useFeedSettingsStore();

  // ========== UI Hook ==========
  const ui = useFeedUI();

  // ========== Confirm Dialog ==========
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // ========== Feature Flags ==========
  const [hasMakeupSystem, setHasMakeupSystem] = useState(false);

  // ========== Tenant Settings ==========
  const [basicSettings, setBasicSettings] = useState<BasicSettings>({
    progress_enabled: false,
    materials_enabled: false,
    exam_score_enabled: false,
  });
  const [makeupDefaults, setMakeupDefaults] = useState<Record<string, boolean>>({
    '병결': true,
    '학교행사': true,
    '가사': false,
    '무단': false,
    '기타': true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // ========== Tenant ID ==========
  const [cachedTenantId, setCachedTenantId] = useState<string | null>(null);

  const getTenantId = useCallback(async (): Promise<string | null> => {
    if (cachedTenantId) return cachedTenantId;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (error || !profile?.tenant_id) return null;
    setCachedTenantId(profile.tenant_id);
    return profile.tenant_id;
  }, [supabase, cachedTenantId]);

  // ========== Preset Hooks ==========
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
    loadOptionSets: loadData,
    presetStorageKey,
    beforeApply: () => {
      setShowWizard(false);
      ui.closeTemplateModal();
      ui.closeAddItemForm();
      setShowPresetModal(false);
      setPresetName('');
    },
  });

  // ========== Effects ==========
  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  // Tenant Settings 로드
  useEffect(() => {
    const loadSettings = async () => {
      setSettingsLoading(true);
      const result = await getTenantSettings();
      if (result.ok && result.data) {
        setBasicSettings(result.data.basic);
        setMakeupDefaults(result.data.makeup.makeup_defaults);
      }
      setSettingsLoading(false);
    };
    
    loadSettings();
  }, []);

  // Basic Settings 업데이트 핸들러
  const handleUpdateBasicSetting = useCallback(async (key: keyof BasicSettings, value: boolean) => {
    const newSettings = { ...basicSettings, [key]: value };
    setBasicSettings(newSettings); // Optimistic update
    setSettingsSaving(true);
    
    const result = await updateBasicSettings(newSettings);
    if (result.ok) {
      toast.success('설정이 저장되었습니다', { duration: 2000 });
    } else {
      setBasicSettings(basicSettings); // Rollback
      toast.error('설정 저장에 실패했습니다');
    }
    setSettingsSaving(false);
  }, [basicSettings]);

  // Makeup Settings 업데이트 핸들러
  const handleUpdateMakeupDefault = useCallback(async (reasonKey: string, checked: boolean) => {
    if (!hasMakeupSystem) return;
    
    const newDefaults = { ...makeupDefaults, [reasonKey]: checked };
    setMakeupDefaults(newDefaults); // Optimistic update
    setSettingsSaving(true);
    
    const result = await updateMakeupSettings(newDefaults);
    if (result.ok) {
      toast.success('보강 설정이 저장되었습니다', { duration: 2000 });
    } else {
      setMakeupDefaults(makeupDefaults); // Rollback
      toast.error('설정 저장에 실패했습니다');
    }
    setSettingsSaving(false);
  }, [makeupDefaults, hasMakeupSystem]);

  // ========== Handlers ==========
  const handleUpdateSetName = useCallback(async (setId: string) => {
    const success = await updateSetName(setId, ui.editingSetName);
    if (success) {
      ui.cancelEditingSetName();
    }
  }, [updateSetName, ui]);

  const handleChangeSetCategory = useCallback(async (
    set: typeof optionSets[0],
    newCategory: ReportCategory
  ) => {
    const success = await changeSetCategory(set, newCategory);
    if (success) {
      ui.setIsEditMode(false);
    }
  }, [changeSetCategory, ui]);

  const handleDuplicateSet = useCallback(async (set: typeof optionSets[0]) => {
    const newSet = await duplicateSet(set);
    if (newSet) {
      ui.startEditingSetName(newSet.id, `${set.name} (복제)`);
    }
  }, [duplicateSet, ui]);

  const handleDeleteSet = useCallback(async (set: typeof optionSets[0]) => {
    const ok = await confirm({
      title: '평가항목 삭제',
      description: `"${set.name}" 세트를 삭제할까요?\n\n세트는 보관(archived) 처리되고, 포함된 선택지도 비활성화됩니다.\n\n※ 기존에 기록된 리포트 데이터는 삭제되지 않습니다.`,
      confirmLabel: '삭제',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteSet(set.id);
  }, [confirm, deleteSet]);

  const handleAddNewItem = useCallback(async () => {
    if (!ui.newItemName.trim()) {
      toast.error('평가항목명을 입력하세요');
      return;
    }
    if (!ui.newItemCategory) {
      toast.error('AI 리포트 영역을 먼저 선택해주세요');
      return;
    }
    if (!currentTemplate) {
      ui.openTemplateModal(ui.newItemName);
      return;
    }

    const created = await addItemWithTemplate(currentTemplate, ui.newItemName, ui.newItemCategory);
    if (created) {
      ui.closeAddItemForm();
      ui.markAsNewlyCreated(created.id);
      setTimeout(() => {
        document.getElementById(`option-set-${created.id}`)?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [addItemWithTemplate, currentTemplate, ui]);

  const handleTemplateSelect = useCallback(async (template: 'precise' | 'general' | 'text') => {
    const name = ui.pendingItemName || ui.newItemName;
    const category = ui.newItemCategory;

    if (!name.trim()) {
      toast.error('평가항목명을 입력하세요');
      ui.closeTemplateModal();
      return;
    }
    if (!category) {
      toast.error('AI 리포트 영역을 먼저 선택해주세요');
      ui.closeTemplateModal();
      return;
    }

    const created = await addItemWithTemplate(template, name, category);
    if (created) {
      ui.closeTemplateModal();
      ui.closeAddItemForm();
    }
  }, [addItemWithTemplate, ui]);

  const handleResetSettings = useCallback(async () => {
    const ok = await confirm({
      title: '전체 삭제',
      description: '기존 설정이 모두 삭제(보관)됩니다.\n계속하시겠습니까?',
      confirmLabel: '삭제',
      variant: 'danger',
    });
    if (!ok) return;

    const archived = await archiveAllCurrentSets();
    if (!archived) return;

    await clearLastAppliedPreset();
    setShowWizard(false);
    ui.closeAddItemForm();
    setCurrentTemplate(null);
  }, [archiveAllCurrentSets, clearLastAppliedPreset, confirm, setCurrentTemplate, setShowWizard, ui]);

  const handleEmptyTemplateSelect = useCallback((key: 'custom' | 'basic' | 'english' | 'text') => {
    if (key === 'custom') {
      setShowWizard(true);
      setWizardStep('scoring');
    } else {
      void applyTemplate(key);
    }
  }, [applyTemplate, setShowWizard, setWizardStep]);

  // ========== Render ==========
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500">불러오는 중...</div>
      </div>
    );
  }

  if (optionSets.length === 0 && !showWizard && !currentTemplate) {
    return <EmptyState onSelectTemplate={handleEmptyTemplateSelect} />;
  }

  return (
    <div className={feedStyles.layout.page}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className={feedStyles.text.pageTitle}>피드 설정</h1>
          {currentTemplate && (
            <span className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded">
              {currentTemplate === 'text' ? '문장형' : currentTemplate === 'precise' ? '5점 단위' : '10점 단위'}
            </span>
          )}
        </div>

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
              <CardTitle className="text-base font-semibold text-[#37352F]">평가항목</CardTitle>
              <p className="text-sm text-[#9B9A97] mt-1">학생 피드에 기록할 평가항목을 설정하세요</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>AI 매핑</span>
              <Switch
                checked={ui.isEditMode}
                onCheckedChange={(v) => ui.setIsEditMode(Boolean(v))}
                className="data-[state=checked]:bg-[#6366F1]"
              />
            </div>
          </div>
          {ui.isEditMode && (
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
              ui.openAddItemForm();
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
          {ui.isAddingItem && (
            <AddItemForm
              currentTemplate={currentTemplate}
              newItemName={ui.newItemName}
              newItemCategory={ui.newItemCategory}
              onChangeName={ui.setNewItemName}
              onChangeCategory={ui.setNewItemCategory}
              onSubmit={() => void handleAddNewItem()}
              onCancel={ui.closeAddItemForm}
            />
          )}

          {/* Option Sets */}
          {optionSets.map((set) => (
            <OptionSetCard
              key={set.id}
              set={set}
              expanded={ui.expandedSets.has(set.id)}
              isEditMode={ui.isEditMode}
              isHighlightAdd={ui.newlyCreatedSetId === set.id}
              categoryValue={(categoryDraft[set.id] ?? set.default_report_category ?? 'study') as ReportCategory}
              optionList={options[set.id] ?? []}
              onToggleExpand={() => ui.toggleExpand(set.id)}
              onToggleSetActive={() => void toggleSetActive(set)}
              nameEdit={{
                editing: ui.editingSetId === set.id,
                value: ui.editingSetName,
                onStart: () => ui.startEditingSetName(set.id, set.name),
                onChange: (v) => ui.setEditingSetName(v),
                onConfirm: () => void handleUpdateSetName(set.id),
                onCancel: ui.cancelEditingSetName,
              }}
              onDuplicate={() => void handleDuplicateSet(set)}
              onDeleteSet={() => void handleDeleteSet(set)}
              onChangeCategory={(cat) => void handleChangeSetCategory(set, cat)}
              confirm={confirm}
              sensors={sensors}
              onDragEnd={(event) => void handleOptionDragEnd(set.id, event)}
              onDeleteOption={(optionId) => void deleteOption(optionId)}
              onUpdateOption={(optionId, newLabel, newScore) => void updateOption(optionId, newLabel, newScore)}
              optionDraft={{
                value: ui.optionDraft[set.id] ?? '',
                onChange: (v) => ui.updateOptionDraft(set.id, v),
                onAdd: () => {
                  const draft = (ui.optionDraft[set.id] ?? '').trim();
                  if (!draft) return;
                  ui.clearOptionDraft(set.id);
                  void addOptionFromInput(set.id, draft);
                  if (ui.newlyCreatedSetId === set.id) {
                    ui.clearNewlyCreated();
                  }
                },
              }}
            />
          ))}
        </CardContent>
      </Card>

      {/* 기본 항목 설정 */}
      <BasicSettingsSection
        settings={basicSettings}
        isLoading={settingsLoading}
        isSaving={settingsSaving}
        onUpdateSetting={handleUpdateBasicSetting}
      />

      {/* 결석/보강 설정 */}
      <MakeupSettingsSection
        makeupDefaults={makeupDefaults}
        isLoading={settingsLoading}
        isSaving={settingsSaving}
        hasMakeupSystem={hasMakeupSystem}
        onToggle={handleUpdateMakeupDefault}
        onUpgradeClick={() => {
          toast.info('프리미엄 요금제로 업그레이드하시면 결석/보강 관리 기능을 사용하실 수 있습니다.');
        }}
      />

      {/* Modals */}
      <TemplateSelectModal
        open={ui.showTemplateModal}
        pendingItemName={ui.pendingItemName}
        onSelectPrecise={() => void handleTemplateSelect('precise')}
        onSelectGeneral={() => void handleTemplateSelect('general')}
        onSelectText={() => void handleTemplateSelect('text')}
        onClose={ui.closeTemplateModal}
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

      <ScoringWizardModal
        open={showWizard && wizardStep === 'scoring'}
        onBack={() => setShowWizard(false)}
        onSelectScoring={(key) => {
          void setCustomTemplate(key);
          ui.openAddItemForm();
        }}
      />

      <ConfirmDialog />
    </div>
  );
}
