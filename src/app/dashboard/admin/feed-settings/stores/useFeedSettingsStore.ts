'use client';

import { create } from 'zustand';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';

import type { FeedConfig, OptionSet, Option, ReportCategory, TemplateType } from '@/types/feed-settings';
import { SCORE_STEP, MAX_RETRY_ATTEMPTS, FEED_TEMPLATES, TEMPLATE_TYPE_LABEL, TOAST_MESSAGES } from '../feedSettings.constants';

// Server Actions
import {
  ensureActiveConfig,
  loadOptionSetsWithOptions,
  toggleOptionSetActive,
  deleteOptionSet,
  updateOptionSetName,
  changeOptionSetCategory,
  duplicateOptionSet,
  createOptionSet,
  archiveAllOptionSets,
  createOption,
  updateOption as updateOptionAction,
  deleteOption as deleteOptionAction,
  updateOptionOrder,
  applyTemplate as applyTemplateAction,
} from '../actions/feed-settings.actions';

// ============================================================================
// Types
// ============================================================================

interface FeedSettingsState {
  // === Data State ===
  activeConfig: FeedConfig | null;
  optionSets: OptionSet[];
  options: Record<string, Option[]>;
  categoryDraft: Record<string, ReportCategory>;
  currentTemplate: TemplateType;
  isLoading: boolean;

  // === Wizard State ===
  showWizard: boolean;
  wizardStep: 'template' | 'scoring';

  // === Actions ===
  // Data Loading
  loadData: () => Promise<void>;
  
  // OptionSet CRUD
  toggleSetActive: (set: OptionSet) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  updateSetName: (setId: string, newName: string) => Promise<boolean>;
  changeSetCategory: (set: OptionSet, newCategory: ReportCategory) => Promise<boolean>;
  duplicateSet: (set: OptionSet) => Promise<OptionSet | null>;
  
  // Option CRUD
  handleOptionDragEnd: (setId: string, event: DragEndEvent) => Promise<void>;
  updateOption: (optionId: string, newLabel: string, newScore: number | null) => Promise<void>;
  deleteOption: (optionId: string) => Promise<void>;
  addOptionFromInput: (setId: string, input: string) => Promise<void>;
  
  // Template
  archiveAllCurrentSets: (skipStateUpdate?: boolean) => Promise<boolean>;
  applyTemplate: (templateKey: keyof typeof FEED_TEMPLATES) => Promise<void>;
  setCustomTemplate: (scoringType: Exclude<TemplateType, null>) => void;
  addItemWithTemplate: (
    template: Exclude<TemplateType, null>,
    itemName: string,
    itemCategory: ReportCategory
  ) => Promise<OptionSet | null>;
  
  // Wizard
  openWizard: () => void;
  closeWizard: () => void;
  setWizardStep: (step: 'template' | 'scoring') => void;
  setShowWizard: (show: boolean) => void;
  setCurrentTemplate: (template: TemplateType) => void;
  
  // UI Helpers (Store에서 관리하는 것들)
  expandSet: (setId: string) => void;
  collapseSet: (setId: string) => void;
  setCategoryDraft: (draft: Record<string, ReportCategory>) => void;
}

// ============================================================================
// Helper Functions (순수 함수)
// ============================================================================

function deriveTemplateFromSets(sets: OptionSet[]): TemplateType {
  if (sets.length === 0) return null;
  const first = sets[0];
  if (!first.is_scored) return 'text';
  if (first.score_step === SCORE_STEP.PRECISE) return 'precise';
  return 'general';
}

function parseOptionInput(
  input: string,
  isScored: boolean,
  scoreStep: number | null
): { label: string; score: number | null } | null {
  const raw = input.trim();
  if (!raw) return null;

  let label = raw;
  let score: number | null = null;

  if (isScored) {
    const numberMatches = raw.match(/-?\d+/g);
    if (numberMatches && numberMatches.length > 0) {
      const parsedScore = Number(numberMatches[numberMatches.length - 1]);
      if (!Number.isNaN(parsedScore)) {
        score = parsedScore;
        label = raw.replace(/-?\d+/g, '').trim();
        if (!label) label = '선택지';

        if (scoreStep) {
          const correctedScore = Math.round(score / scoreStep) * scoreStep;
          if (correctedScore !== score) {
            toast.info(`${score} → ${correctedScore}점 자동 보정`);
            score = correctedScore;
          }
        }
      }
    }
  }

  return { label, score };
}

// ============================================================================
// Store
// ============================================================================

// 외부에서 expandedSets를 관리하기 위한 콜백 (UI Hook에서 설정)
let expandedSetsCallback: {
  add: (id: string) => void;
  delete: (id: string) => void;
  clear: () => void;
} | null = null;

export function setExpandedSetsCallback(callback: typeof expandedSetsCallback) {
  expandedSetsCallback = callback;
}

export const useFeedSettingsStore = create<FeedSettingsState>((set, get) => ({
  // ========== Initial State ==========
  activeConfig: null,
  optionSets: [],
  options: {},
  categoryDraft: {},
  currentTemplate: null,
  isLoading: true,
  showWizard: false,
  wizardStep: 'template',

  // ========== Data Loading ==========
  loadData: async () => {
    try {
      set({ isLoading: true });

      // 1. Config 확보
      const configResult = await ensureActiveConfig();
      if (!configResult.ok || !configResult.data) {
        toast.error(configResult.message || '설정을 불러오는데 실패했습니다');
        set({ isLoading: false });
        return;
      }
      const cfg = configResult.data;

      // 2. OptionSets + Options 조회
      const dataResult = await loadOptionSetsWithOptions(cfg.id);
      if (!dataResult.ok || !dataResult.data) {
        toast.error(dataResult.message || '평가항목을 불러오는데 실패했습니다');
        set({ isLoading: false });
        return;
      }

      const { sets, options: optionsMap } = dataResult.data;

      // 3. Category Draft 동기화
      const nextCategoryDraft: Record<string, ReportCategory> = {};
      for (const s of sets) {
        nextCategoryDraft[s.id] = (s.default_report_category ?? 'study') as ReportCategory;
      }

      // 4. Template 타입 추론
      const template = deriveTemplateFromSets(sets);

      // 5. UI 상태
      if (sets.length === 0) {
        expandedSetsCallback?.clear();
      }

      set({
        activeConfig: cfg,
        optionSets: sets,
        options: optionsMap,
        categoryDraft: nextCategoryDraft,
        currentTemplate: template,
        showWizard: sets.length === 0 ? get().showWizard : false,
        isLoading: false,
      });
    } catch (error) {
      console.error('loadData error:', error);
      toast.error('데이터 로딩 중 오류가 발생했습니다');
      set({ isLoading: false });
    }
  },

  // ========== OptionSet CRUD ==========
  toggleSetActive: async (targetSet) => {
    const originalIsActive = targetSet.is_active;

    // Optimistic Update
    set((state) => ({
      optionSets: state.optionSets.map((s) =>
        s.id === targetSet.id ? { ...s, is_active: !s.is_active } : s
      ),
    }));

    if (!targetSet.is_active) {
      expandedSetsCallback?.add(targetSet.id);
    }

    const result = await toggleOptionSetActive(targetSet.id, !targetSet.is_active);

    if (!result.ok) {
      toast.error(result.message);
      // Rollback
      set((state) => ({
        optionSets: state.optionSets.map((s) =>
          s.id === targetSet.id ? { ...s, is_active: originalIsActive } : s
        ),
      }));
    }
  },

  deleteSet: async (setId) => {
    const { optionSets, options } = get();
    const target = optionSets.find((s) => s.id === setId);
    if (!target) return;

    // Backup
    const originalSets = [...optionSets];
    const originalOptions = { ...options };

    // Optimistic Update
    set((state) => ({
      optionSets: state.optionSets.filter((s) => s.id !== setId),
      options: Object.fromEntries(
        Object.entries(state.options).filter(([key]) => key !== setId)
      ),
    }));
    expandedSetsCallback?.delete(setId);

    const result = await deleteOptionSet(setId);

    if (result.ok) {
      toast.success(`"${target.name}" 평가항목이 삭제되었습니다`);
    } else {
      toast.error(result.message);
      // Rollback
      set({ optionSets: originalSets, options: originalOptions });
    }
  },

  updateSetName: async (setId, newName) => {
    const name = newName.trim();
    if (!name) {
      toast.error(TOAST_MESSAGES.ERR_NO_NAME);
      return false;
    }

    const { optionSets } = get();
    const originalSet = optionSets.find((s) => s.id === setId);
    if (!originalSet) return false;
    const originalName = originalSet.name;

    // Optimistic Update
    set((state) => ({
      optionSets: state.optionSets.map((s) =>
        s.id === setId ? { ...s, name } : s
      ),
    }));

    const result = await updateOptionSetName(setId, name);

    if (!result.ok) {
      toast.error(result.message);
      // Rollback
      set((state) => ({
        optionSets: state.optionSets.map((s) =>
          s.id === setId ? { ...s, name: originalName } : s
        ),
      }));
      return false;
    }

    return true;
  },

  changeSetCategory: async (targetSet, newCategory) => {
    const { categoryDraft, options } = get();
    const originalCategory = targetSet.default_report_category as ReportCategory;
    const originalCategoryDraft = categoryDraft[targetSet.id];
    const originalOptions = options[targetSet.id] || [];

    // Optimistic Update
    set((state) => ({
      optionSets: state.optionSets.map((s) =>
        s.id === targetSet.id ? { ...s, default_report_category: newCategory } : s
      ),
      categoryDraft: { ...state.categoryDraft, [targetSet.id]: newCategory },
      options: {
        ...state.options,
        [targetSet.id]: state.options[targetSet.id]?.map((o) => ({
          ...o,
          report_category: newCategory,
        })) || [],
      },
    }));

    const result = await changeOptionSetCategory(targetSet.id, newCategory);

    if (result.ok) {
      toast.success(TOAST_MESSAGES.CATEGORY_CHANGED);
      return true;
    } else {
      toast.error(result.message);
      // Rollback
      set((state) => ({
        optionSets: state.optionSets.map((s) =>
          s.id === targetSet.id ? { ...s, default_report_category: originalCategory } : s
        ),
        categoryDraft: { ...state.categoryDraft, [targetSet.id]: originalCategoryDraft },
        options: { ...state.options, [targetSet.id]: originalOptions },
      }));
      return false;
    }
  },

  duplicateSet: async (sourceSet) => {
    const { activeConfig } = get();
    if (!activeConfig) {
      toast.error(TOAST_MESSAGES.ERR_NO_CONFIG);
      return null;
    }

    const result = await duplicateOptionSet(sourceSet.id, activeConfig.id);

    if (!result.ok || !result.data) {
      toast.error(result.message);
      return null;
    }

    const { set: newSet, options: newOptions } = result.data;

    // 로컬 상태 업데이트
    set((state) => ({
      optionSets: [...state.optionSets, newSet],
      options: { ...state.options, [newSet.id]: newOptions },
      categoryDraft: {
        ...state.categoryDraft,
        [newSet.id]: (newSet.default_report_category ?? 'study') as ReportCategory,
      },
    }));

    toast.success(`"${newSet.name}" 평가항목이 복제되었습니다`);
    expandedSetsCallback?.add(newSet.id);

    return newSet;
  },

  // ========== Option CRUD ==========
  handleOptionDragEnd: async (setId, event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const { options } = get();
    const current = options[setId] ?? [];
    const oldIndex = current.findIndex((o) => o.id === active.id);
    const newIndex = current.findIndex((o) => o.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(current, oldIndex, newIndex);

    // Optimistic Update
    set((state) => ({
      options: { ...state.options, [setId]: reordered },
    }));

    // Server 요청
    const updates = reordered.map((o, idx) => ({ id: o.id, displayOrder: idx }));
    const result = await updateOptionOrder(updates);

    if (!result.ok) {
      toast.error(result.message);
      // Rollback
      set((state) => ({
        options: { ...state.options, [setId]: current },
      }));
    }
  },

  updateOption: async (optionId, newLabel, newScore) => {
    const { options } = get();
    
    // 대상 찾기
    let targetSetId: string | null = null;
    let originalOption: Option | null = null;

    for (const [setId, opts] of Object.entries(options)) {
      const found = opts.find((o) => o.id === optionId);
      if (found) {
        targetSetId = setId;
        originalOption = found;
        break;
      }
    }

    if (!targetSetId || !originalOption) return;

    // Optimistic Update
    set((state) => ({
      options: {
        ...state.options,
        [targetSetId!]: state.options[targetSetId!].map((o) =>
          o.id === optionId ? { ...o, label: newLabel, score: newScore } : o
        ),
      },
    }));

    const result = await updateOptionAction(optionId, newLabel, newScore);

    if (!result.ok) {
      toast.error(result.message);
      // Rollback
      set((state) => ({
        options: {
          ...state.options,
          [targetSetId!]: state.options[targetSetId!].map((o) =>
            o.id === optionId ? originalOption! : o
          ),
        },
      }));
    }
  },

  deleteOption: async (optionId) => {
    const { options } = get();
    
    // 대상 찾기
    let targetSetId: string | null = null;
    let originalOption: Option | null = null;
    let originalIndex = -1;

    for (const [setId, opts] of Object.entries(options)) {
      const idx = opts.findIndex((o) => o.id === optionId);
      if (idx !== -1) {
        targetSetId = setId;
        originalOption = opts[idx];
        originalIndex = idx;
        break;
      }
    }

    if (!targetSetId || !originalOption) return;

    // Optimistic Update
    set((state) => ({
      options: {
        ...state.options,
        [targetSetId!]: state.options[targetSetId!].filter((o) => o.id !== optionId),
      },
    }));

    const result = await deleteOptionAction(optionId);

    if (!result.ok) {
      toast.error(result.message);
      // Rollback
      set((state) => {
        const current = [...state.options[targetSetId!]];
        current.splice(originalIndex, 0, originalOption!);
        return { options: { ...state.options, [targetSetId!]: current } };
      });
    }
  },

  addOptionFromInput: async (setId, input) => {
    const { optionSets, options, categoryDraft } = get();
    const targetSet = optionSets.find((s) => s.id === setId);
    if (!targetSet) return;

    const parsed = parseOptionInput(input, targetSet.is_scored, targetSet.score_step);
    if (!parsed) return;

    const { label, score } = parsed;
    const currentOptions = options[setId] || [];
    const maxOrder = Math.max(...currentOptions.map((o) => o.display_order), -1);
    const category: ReportCategory =
      categoryDraft[setId] ??
      (targetSet.default_report_category as ReportCategory | undefined) ??
      'study';

    // 임시 ID로 Optimistic Update
    const tempId = `temp_${Date.now()}`;
    const optimisticOption: Option = {
      id: tempId,
      set_id: setId,
      label,
      score,
      display_order: maxOrder + 1,
      is_active: true,
      report_category: category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set((state) => ({
      options: {
        ...state.options,
        [setId]: [...(state.options[setId] || []), optimisticOption],
      },
    }));

    const result = await createOption({
      setId,
      label,
      score,
      displayOrder: maxOrder + 1,
      category,
    });

    if (!result.ok || !result.data) {
      toast.error(result.message);
      // Rollback
      set((state) => ({
        options: {
          ...state.options,
          [setId]: state.options[setId].filter((o) => o.id !== tempId),
        },
      }));
      return;
    }

    // 성공: 임시 ID → 실제 ID
    set((state) => ({
      options: {
        ...state.options,
        [setId]: state.options[setId].map((o) =>
          o.id === tempId ? result.data! : o
        ),
      },
    }));

    if (targetSet.is_scored && score === null) {
      toast.success(`"${label}" 추가됨 (점수 제외)`);
    }
  },

  // ========== Template ==========
  archiveAllCurrentSets: async (skipStateUpdate = false) => {
    const { activeConfig, optionSets } = get();
    if (!activeConfig) return false;
    if (optionSets.length === 0) return true;

    const result = await archiveAllOptionSets(activeConfig.id);

    if (!result.ok) {
      toast.error(result.message);
      return false;
    }

    if (!skipStateUpdate) {
      set({ optionSets: [], options: {} });
      expandedSetsCallback?.clear();
    }

    return true;
  },

  applyTemplate: async (templateKey) => {
    let { activeConfig } = get();
    const { archiveAllCurrentSets, loadData } = get();
    
    // activeConfig가 없으면 먼저 로드
    if (!activeConfig) {
      await loadData();
      activeConfig = get().activeConfig;
      
      if (!activeConfig) {
        toast.error(TOAST_MESSAGES.ERR_NO_CONFIG);
        return;
      }
    }

    if (templateKey === 'custom') {
      const archived = await archiveAllCurrentSets(true);
      if (!archived) return;

      set({
        currentTemplate: null,
        wizardStep: 'scoring',
        optionSets: [],
        options: {},
      });
      expandedSetsCallback?.clear();
      return;
    }

    const template = FEED_TEMPLATES[templateKey];
    if (!('data' in template) || !template.data) return;

    // 템플릿 타입 설정
    let newTemplate: TemplateType = 'general';
    if (templateKey === 'text') newTemplate = 'text';
    else if (templateKey === 'english') newTemplate = 'precise';

    const result = await applyTemplateAction(activeConfig.id, template.data);

    if (!result.ok || !result.data) {
      toast.error(result.message);
      return;
    }

    const { sets, options: newOptions } = result.data;

    const nextCategoryDraft: Record<string, ReportCategory> = {};
    for (const s of sets) {
      nextCategoryDraft[s.id] = (s.default_report_category ?? 'study') as ReportCategory;
    }

    set({
      currentTemplate: newTemplate,
      optionSets: sets,
      options: newOptions,
      categoryDraft: nextCategoryDraft,
      showWizard: false,
      wizardStep: 'template',
    });
    expandedSetsCallback?.clear();

    toast.success(TOAST_MESSAGES.TEMPLATE_APPLIED);
  },

  setCustomTemplate: (scoringType) => {
    set({
      currentTemplate: scoringType,
      showWizard: false,
      wizardStep: 'template',
    });
    toast.success(`${TEMPLATE_TYPE_LABEL[scoringType]} 템플릿이 선택되었습니다`);
  },

  addItemWithTemplate: async (template, itemName, itemCategory) => {
    const { activeConfig } = get();
    if (!activeConfig) {
      toast.error(TOAST_MESSAGES.ERR_NO_CONFIG);
      return null;
    }

    const finalName = itemName.trim();
    if (!finalName) {
      toast.error('평가항목명을 입력하세요.');
      return null;
    }

    if (!itemCategory) {
      toast.error('AI 리포트 영역을 먼저 선택해주세요');
      return null;
    }

    const templateConfig = {
      precise: { isScored: true, scoreStep: SCORE_STEP.PRECISE },
      general: { isScored: true, scoreStep: SCORE_STEP.GENERAL },
      text: { isScored: false, scoreStep: null },
    } as const;

    const config = templateConfig[template];
    const timestamp = Date.now();

    let attempts = 0;
    let created: OptionSet | null = null;

    while (!created && attempts < MAX_RETRY_ATTEMPTS) {
      attempts++;
      const attemptName = attempts === 1 ? finalName : `${finalName} (${attempts})`;

      const result = await createOptionSet({
        configId: activeConfig.id,
        name: attemptName,
        setKey: `cat_${timestamp}_${attempts}`,
        isScored: config.isScored,
        scoreStep: config.scoreStep,
        category: itemCategory,
      });

      if (result.ok && result.data) {
        created = result.data;
        toast.success(`'${attemptName}' 평가항목이 추가되었습니다`);
      } else if (result.message?.toLowerCase().includes('duplicate')) {
        continue;
      } else {
        toast.error(result.message);
        return null;
      }
    }

    if (!created) {
      toast.error('추가 실패: 이름 중복이 계속 발생했습니다');
      return null;
    }

    // 로컬 상태 업데이트
    set((state) => ({
      currentTemplate: template,
      optionSets: [...state.optionSets, created!],
      options: { ...state.options, [created!.id]: [] },
      categoryDraft: { ...state.categoryDraft, [created!.id]: itemCategory },
    }));

    // 새로 만든 세트만 펼치기
    expandedSetsCallback?.clear();
    expandedSetsCallback?.add(created.id);

    return created;
  },

  // ========== Wizard ==========
  openWizard: () => set({ showWizard: true, wizardStep: 'template' }),
  closeWizard: () => set({ showWizard: false, wizardStep: 'template' }),
  setWizardStep: (step) => set({ wizardStep: step }),
  setShowWizard: (show) => set({ showWizard: show }),
  setCurrentTemplate: (template) => set({ currentTemplate: template }),

  // ========== UI Helpers ==========
  expandSet: (setId) => expandedSetsCallback?.add(setId),
  collapseSet: (setId) => expandedSetsCallback?.delete(setId),
  setCategoryDraft: (draft) => set({ categoryDraft: draft }),
}));
