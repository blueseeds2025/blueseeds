'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';

import type { Database } from '@/lib/database.types';
import type { FeedConfig, OptionSet, Option, ReportCategory, TemplateType } from '@/types/feed-settings';
import { SCORE_STEP, MAX_RETRY_ATTEMPTS, FEED_TEMPLATES, TEMPLATE_TYPE_LABEL } from '../feedSettings.constants';

type SupabaseClient = ReturnType<typeof import('@supabase/ssr').createBrowserClient<Database>>;

type Params = {
  supabase: SupabaseClient;
  getTenantId: () => Promise<string | null>;

  // UI side effects
  setExpandedSets: React.Dispatch<React.SetStateAction<Set<string>>>;

  toastLoadFail: () => void;
  toastSaveFail: () => void;
};

export function useFeedData({
  supabase,
  getTenantId,
  setExpandedSets,
  toastLoadFail,
  toastSaveFail,
}: Params) {
  // ========== State ==========
  const [activeConfig, setActiveConfig] = useState<FeedConfig | null>(null);
  const [optionSets, setOptionSets] = useState<OptionSet[]>([]);
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [categoryDraft, setCategoryDraft] = useState<Record<string, ReportCategory>>({});
  const [currentTemplate, setCurrentTemplate] = useState<TemplateType>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<'template' | 'scoring'>('template');
  const [isLoading, setIsLoading] = useState(true); // ✅ 초기 로딩 상태

  // ========== Config Loaders ==========
  const loadActiveConfig = useCallback(async (): Promise<FeedConfig | null> => {
    const tenantId = await getTenantId();
    if (!tenantId) return null;

    const { data: cfg, error } = await supabase
      .from('feed_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      toastLoadFail();
      return null;
    }
    return (cfg as FeedConfig) ?? null;
  }, [getTenantId, supabase, toastLoadFail]);

  const ensureActiveConfig = useCallback(async (): Promise<FeedConfig> => {
    const existing = await loadActiveConfig();
    if (existing) {
      setActiveConfig(existing);
      return existing;
    }

    const tenantId = await getTenantId();
    if (!tenantId) throw new Error('tenant_id missing');

    const { data: created, error } = await supabase
      .from('feed_configs')
      .insert({
        tenant_id: tenantId,
        name: '기본 설정 V1',
        is_active: true,
        applied_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !created) throw error ?? new Error('config create failed');
    
    const cfg = created as FeedConfig;
    setActiveConfig(cfg);
    return cfg;
  }, [getTenantId, loadActiveConfig, supabase]);

  // ========== Template Detection ==========
  const deriveTemplateFromSets = useCallback((sets: OptionSet[]): TemplateType => {
    if (sets.length === 0) return null;
    const first = sets[0];
    if (!first.is_scored) return 'text';
    if (first.score_step === SCORE_STEP.PRECISE) return 'precise';
    return 'general';
  }, []);

  // ========== Load Option Sets ==========
  const loadOptionSets = useCallback(async () => {
    try {
      setIsLoading(true); // ✅ 로딩 시작
      const cfg = await ensureActiveConfig();

      const { data, error } = await supabase
        .from('feed_option_sets')
        .select('*')
        .is('deleted_at', null)
        .eq('config_id', cfg.id)
        .order('created_at');

      if (error) {
        toastLoadFail();
        return;
      }

      const sets = (data ?? []) as OptionSet[];
      setOptionSets(sets);

      // category draft 동기화
      const nextCategoryDraft: Record<string, ReportCategory> = {};
      for (const set of sets) {
        nextCategoryDraft[set.id] = (set.default_report_category ?? 'study') as ReportCategory;
      }
      setCategoryDraft(nextCategoryDraft);

      // template 표시
      const t = deriveTemplateFromSets(sets);
      setCurrentTemplate(t);

      // options load (한 번에 로드 후 그룹핑)
      const setIds = sets.map((s) => s.id);
      const nextOptions: Record<string, Option[]> = {};
      for (const id of setIds) nextOptions[id] = [];

      if (setIds.length > 0) {
        const { data: allOpts, error: optError } = await supabase
          .from('feed_options')
          .select('*')
          .in('set_id', setIds)
          .eq('is_active', true)
          .order('display_order');

        if (optError) {
          toastLoadFail();
          return;
        }

        for (const opt of (allOpts ?? []) as Option[]) {
          (nextOptions[opt.set_id] ??= []).push(opt);
        }
      }

      setOptions(nextOptions);

      if (sets.length === 0) {
        setExpandedSets(new Set());
        // showWizard는 건드리지 않음 - EmptyState가 보이도록
      } else {
        setShowWizard(false);
      }
    } catch (err) {
      toastLoadFail();
    } finally {
      setIsLoading(false); // ✅ 로딩 완료
    }
  }, [
    deriveTemplateFromSets,
    ensureActiveConfig,
    setExpandedSets,
    supabase,
    toastLoadFail,
  ]);

  // ========== Initial Load ==========
  useEffect(() => {
    void loadOptionSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 1회만 실행

  // ========== Option DnD ==========
  const persistOptionOrder = useCallback(
    async (setId: string, reordered: Option[]) => {
      const jobs = reordered.map((o, idx) =>
        supabase.from('feed_options').update({ display_order: idx }).eq('id', o.id)
      );

      const results = await Promise.all(jobs);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) toastSaveFail();
    },
    [supabase, toastSaveFail]
  );

  const handleOptionDragEnd = useCallback(
    async (setId: string, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const current = options[setId] ?? [];
      const oldIndex = current.findIndex((o) => o.id === active.id);
      const newIndex = current.findIndex((o) => o.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const reordered = arrayMove(current, oldIndex, newIndex);
      setOptions((prev) => ({ ...prev, [setId]: reordered }));
      await persistOptionOrder(setId, reordered);
    },
    [options, persistOptionOrder]
  );

  // ========== Option CRUD (Optimistic Updates) ==========
  
  /**
   * ✅ updateOption - Optimistic Update 적용
   * 화면 먼저 업데이트 → 서버 요청 → 실패시 롤백
   */
  const updateOption = useCallback(
    async (optionId: string, newLabel: string, newScore: number | null) => {
      // 1. 어떤 setId에 속한 옵션인지 찾기
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

      // 2. Optimistic Update - 화면 먼저 변경
      setOptions((prev) => ({
        ...prev,
        [targetSetId!]: prev[targetSetId!].map((o) =>
          o.id === optionId ? { ...o, label: newLabel, score: newScore } : o
        ),
      }));

      // 3. 서버 요청
      const { error } = await supabase
        .from('feed_options')
        .update({ label: newLabel, score: newScore })
        .eq('id', optionId);

      // 4. 실패시 롤백
      if (error) {
        toastSaveFail();
        setOptions((prev) => ({
          ...prev,
          [targetSetId!]: prev[targetSetId!].map((o) =>
            o.id === optionId ? originalOption! : o
          ),
        }));
      }
    },
    [options, supabase, toastSaveFail]
  );

  /**
   * ✅ deleteOption - Optimistic Update 적용
   * 화면에서 즉시 제거 → 서버 요청 → 실패시 복원
   */
  const deleteOption = useCallback(
    async (optionId: string) => {
      // 1. 어떤 setId에 속한 옵션인지 찾기
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

      // 2. Optimistic Update - 화면에서 즉시 제거
      setOptions((prev) => ({
        ...prev,
        [targetSetId!]: prev[targetSetId!].filter((o) => o.id !== optionId),
      }));

      // 3. 서버 요청
      const { error } = await supabase
        .from('feed_options')
        .update({ is_active: false })
        .eq('id', optionId);

      // 4. 실패시 원래 위치에 복원
      if (error) {
        toastSaveFail();
        setOptions((prev) => {
          const current = [...prev[targetSetId!]];
          current.splice(originalIndex, 0, originalOption!);
          return { ...prev, [targetSetId!]: current };
        });
      }
    },
    [options, supabase, toastSaveFail]
  );

  /**
   * ✅ addOptionFromInput - Optimistic Update 적용
   * 임시 ID로 즉시 추가 → 서버 요청 → 성공시 실제 ID로 교체, 실패시 제거
   */
  const addOptionFromInput = useCallback(
    async (setId: string, input: string) => {
      const set = optionSets.find((s) => s.id === setId);
      if (!set) return;

      const raw = input.trim();
      if (!raw) return;

      let label = raw;
      let score: number | null = null;

      if (set.is_scored) {
        const numberMatches = raw.match(/-?\d+/g);
        if (!numberMatches || numberMatches.length === 0) {
          // 점수 없으면 점수 제외 옵션으로 처리
          score = null;
          label = raw.trim();
        } else {
          const parsedScore = Number(numberMatches[numberMatches.length - 1]);
          if (Number.isNaN(parsedScore)) {
            toast.error('점수 형식이 올바르지 않습니다');
            return;
          }

          score = parsedScore;
          label = raw.replace(/-?\d+/g, '').trim();
          if (!label) label = '선택지';

          if (set.score_step) {
            const correctedScore = Math.round(score / set.score_step) * set.score_step;
            if (correctedScore !== score) {
              toast.info(`${score} → ${correctedScore}점 자동 보정`);
              score = correctedScore;
            }
          }
        }
      }

      const currentOptions = options[setId] || [];
      const maxOrder = Math.max(...currentOptions.map((o) => o.display_order), -1);

      const category: ReportCategory =
        categoryDraft[setId] ??
        (set.default_report_category as ReportCategory | undefined) ??
        'study';

      // 1. 임시 ID 생성
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

      // 2. Optimistic Update - 즉시 추가
      setOptions((prev) => ({
        ...prev,
        [setId]: [...(prev[setId] || []), optimisticOption],
      }));

      // 3. 서버 요청
      const insertData: Record<string, unknown> = {
        set_id: setId,
        label,
        display_order: maxOrder + 1,
        is_active: true,
        report_category: category,
      };
      
      // score가 null이 아닐 때만 포함
      if (score !== null) {
        insertData.score = score;
      }
      
      const { data, error } = await supabase
        .from('feed_options')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        // 4a. 실패시 임시 항목 제거
        console.error('옵션 추가 실패:', error); // 에러 로그 추가
        toastSaveFail();
        setOptions((prev) => ({
          ...prev,
          [setId]: prev[setId].filter((o) => o.id !== tempId),
        }));
        return;
      }

      // 4b. 성공시 임시 ID를 실제 ID로 교체
      setOptions((prev) => ({
        ...prev,
        [setId]: prev[setId].map((o) => (o.id === tempId ? (data as Option) : o)),
      }));
      
      // 점수 제외 옵션일 경우 안내 토스트
      if (set.is_scored && score === null) {
        toast.success(`"${label}" 추가됨 (점수 제외)`);
      }
    },
    [categoryDraft, optionSets, options, supabase, toastSaveFail]
  );

  // ========== Set CRUD (Optimistic Updates) ==========
  
  /**
   * ✅ toggleSetActive - Optimistic Update 적용
   */
  const toggleSetActive = useCallback(
    async (set: OptionSet) => {
      const originalIsActive = set.is_active;
      
      // 1. Optimistic Update
      setOptionSets((prev) =>
        prev.map((s) => (s.id === set.id ? { ...s, is_active: !s.is_active } : s))
      );

      if (!set.is_active) {
        setExpandedSets((prev) => {
          const next = new Set(prev);
          next.add(set.id);
          return next;
        });
      }

      // 2. 서버 요청
      const { error } = await supabase
        .from('feed_option_sets')
        .update({ is_active: !set.is_active })
        .eq('id', set.id);

      // 3. 실패시 롤백
      if (error) {
        toastSaveFail();
        setOptionSets((prev) =>
          prev.map((s) => (s.id === set.id ? { ...s, is_active: originalIsActive } : s))
        );
      }
    },
    [setExpandedSets, supabase, toastSaveFail]
  );

  /**
   * ✅ deleteSet - Optimistic Update 적용
   * confirm 없이 바로 삭제 (confirm은 FeedSettingsClient에서 처리)
   */
  const deleteSet = useCallback(
    async (setId: string) => {
      const target = optionSets.find((s) => s.id === setId);
      if (!target) return;

      // 백업 (롤백용)
      const originalSets = [...optionSets];
      const originalOptions = { ...options };
      const targetOptions = options[setId] || [];

      // 1. Optimistic Update - 즉시 제거
      setOptionSets((prev) => prev.filter((s) => s.id !== setId));
      setOptions((prev) => {
        const next = { ...prev };
        delete next[setId];
        return next;
      });
      setExpandedSets((prev) => {
        const next = new Set(prev);
        next.delete(setId);
        return next;
      });

      try {
        // 2. 서버 요청
        const { error: optionError } = await supabase
          .from('feed_options')
          .update({ is_active: false })
          .eq('set_id', setId);

        if (optionError) throw optionError;

        const { error: setError } = await supabase
          .from('feed_option_sets')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', setId);

        if (setError) throw setError;

        toast.success(`"${target.name}" 평가항목이 삭제되었습니다`);
      } catch {
        // 3. 실패시 롤백
        toastSaveFail();
        setOptionSets(originalSets);
        setOptions(originalOptions);
      }
    },
    [optionSets, options, setExpandedSets, supabase, toastSaveFail]
  );

  /**
   * ✅ updateSetName - Optimistic Update 적용
   */
  const updateSetName = useCallback(
    async (setId: string, newName: string) => {
      const name = newName.trim();
      if (!name) {
        toast.error('이름을 입력하세요');
        return false;
      }

      // 원본 백업
      const originalSet = optionSets.find((s) => s.id === setId);
      if (!originalSet) return false;
      const originalName = originalSet.name;

      // 1. Optimistic Update
      setOptionSets((prev) =>
        prev.map((s) => (s.id === setId ? { ...s, name } : s))
      );

      // 2. 서버 요청
      const { error } = await supabase
        .from('feed_option_sets')
        .update({ name })
        .eq('id', setId);

      if (error) {
        // 3. 실패시 롤백
        toastSaveFail();
        setOptionSets((prev) =>
          prev.map((s) => (s.id === setId ? { ...s, name: originalName } : s))
        );
        return false;
      }

      return true;
    },
    [optionSets, supabase, toastSaveFail]
  );

  /**
   * ✅ changeSetCategory - Optimistic Update 적용
   */
  const changeSetCategory = useCallback(
    async (set: OptionSet, newCategory: ReportCategory) => {
      const originalCategory = set.default_report_category as ReportCategory;
      const originalCategoryDraft = categoryDraft[set.id];
      const originalOptions = options[set.id] || [];

      // 1. Optimistic Update
      setOptionSets((prev) =>
        prev.map((s) => (s.id === set.id ? { ...s, default_report_category: newCategory } : s))
      );
      setCategoryDraft((prev) => ({ ...prev, [set.id]: newCategory }));
      setOptions((prev) => ({
        ...prev,
        [set.id]: prev[set.id]?.map((o) => ({ ...o, report_category: newCategory })) || [],
      }));

      try {
        // 2. 서버 요청
        const { error: setError } = await supabase
          .from('feed_option_sets')
          .update({ default_report_category: newCategory })
          .eq('id', set.id);
        if (setError) throw setError;

        const { error: optError } = await supabase
          .from('feed_options')
          .update({ report_category: newCategory })
          .eq('set_id', set.id);
        if (optError) throw optError;

        toast.success('AI 리포트 영역이 변경되었습니다');
        return true;
      } catch {
        // 3. 실패시 롤백
        toastSaveFail();
        setOptionSets((prev) =>
          prev.map((s) => (s.id === set.id ? { ...s, default_report_category: originalCategory } : s))
        );
        setCategoryDraft((prev) => ({ ...prev, [set.id]: originalCategoryDraft }));
        setOptions((prev) => ({
          ...prev,
          [set.id]: originalOptions,
        }));
        return false;
      }
    },
    [categoryDraft, options, supabase, toastSaveFail]
  );

  /**
   * duplicateSet - 새 데이터 생성이므로 loadOptionSets 유지
   * (서버에서 ID 받아와야 하므로 Optimistic 불가)
   */
  const duplicateSet = useCallback(
    async (set: OptionSet) => {
      try {
        const cfg = activeConfig ?? (await loadActiveConfig());
        if (!cfg) {
          toast.error('현재 버전(Config)을 찾을 수 없습니다');
          return;
        }

        const tenantId = await getTenantId();
        if (!tenantId) {
          toast.error('tenant_id 없음');
          return;
        }

        const baseName = `${set.name} (복제)`;
        const timestamp = Date.now();

        const { data: newSet, error: setError } = await supabase
          .from('feed_option_sets')
          .insert({
            config_id: cfg.id,
            tenant_id: tenantId,
            name: baseName,
            set_key: `${set.set_key}_copy_${timestamp}`,
            category: baseName,
            is_scored: set.is_scored,
            score_step: set.score_step,
            is_active: true,
            default_report_category: set.default_report_category ?? 'study',
          })
          .select('*')
          .single();

        if (setError || !newSet) {
          toastSaveFail();
          return;
        }

        const { data: oldOptions, error: optLoadError } = await supabase
          .from('feed_options')
          .select('*')
          .eq('set_id', set.id)
          .eq('is_active', true)
          .order('display_order');

        if (optLoadError) {
          toastSaveFail();
          return;
        }

        let newOptions: Option[] = [];

        if (oldOptions && oldOptions.length > 0) {
          const inserts = oldOptions.map((o: any, idx: number) => ({
            set_id: newSet.id,
            label: o.label,
            score: o.score,
            display_order: idx,
            is_active: true,
            report_category: o.report_category ?? (set.default_report_category ?? 'study'),
          }));

          const { data: insertedOpts, error: optInsertError } = await supabase
            .from('feed_options')
            .insert(inserts)
            .select();

          if (optInsertError) {
            toastSaveFail();
            return;
          }
          
          newOptions = (insertedOpts ?? []) as Option[];
        }

        // 로컬 상태 직접 업데이트 (loadOptionSets 대신)
        const createdSet = newSet as OptionSet;
        setOptionSets((prev) => [...prev, createdSet]);
        setOptions((prev) => ({ ...prev, [createdSet.id]: newOptions }));
        setCategoryDraft((prev) => ({
          ...prev,
          [createdSet.id]: (createdSet.default_report_category ?? 'study') as ReportCategory,
        }));

        toast.success(`"${baseName}" 평가항목이 복제되었습니다`);

        setExpandedSets((prev) => {
          const next = new Set(prev);
          next.add(newSet.id);
          return next;
        });

        return newSet;
      } catch {
        toast.error('복제 중 시스템 오류');
        return null;
      }
    },
    [activeConfig, getTenantId, loadActiveConfig, setExpandedSets, supabase, toastSaveFail]
  );

  // ========== Template Functions ==========
  /**
   * archiveAllCurrentSets - confirm 없이 바로 실행
   * confirm은 FeedSettingsClient에서 처리
   * @param skipStateUpdate - true면 로컬 상태 업데이트 건너뜀 (applyTemplate에서 직접 처리)
   */
  const archiveAllCurrentSets = useCallback(async (skipStateUpdate = false): Promise<boolean> => {
    if (optionSets.length === 0) return true;

    const ids = optionSets.map((s) => s.id);
    const { error } = await supabase
      .from('feed_option_sets')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .in('id', ids);

    if (error) {
      toastSaveFail();
      return false;
    }

    const { error: optErr } = await supabase
      .from('feed_options')
      .update({ is_active: false })
      .in('set_id', ids);

    if (optErr) {
      toastSaveFail();
      return false;
    }

    // 상태 업데이트 (skipStateUpdate가 false일 때만)
    if (!skipStateUpdate) {
      setOptionSets([]);
      setOptions({});
      setExpandedSets(new Set());
    }

    return true;
  }, [optionSets, setExpandedSets, supabase, toastSaveFail]);

  const applyTemplate = useCallback(
    async (templateKey: keyof typeof FEED_TEMPLATES) => {
      try {
        const cfg = await ensureActiveConfig();

        // skipStateUpdate=true: 상태 업데이트는 아래에서 한 번에 처리
        const okArchived = await archiveAllCurrentSets(true);
        if (okArchived === false) return;

        if (templateKey === 'custom') {
          setCurrentTemplate(null);
          setWizardStep('scoring');
          // custom은 여기서 상태 비움
          setOptionSets([]);
          setOptions({});
          setExpandedSets(new Set());
          return;
        }

        const template = FEED_TEMPLATES[templateKey];
        if (!('data' in template)) return;

        const tenantId = await getTenantId();
        if (!tenantId) {
          toast.error('tenant_id 없음');
          return;
        }

        if (templateKey === 'text') setCurrentTemplate('text');
        else if (templateKey === 'english') setCurrentTemplate('precise');
        else setCurrentTemplate('general');

        const timestamp = Date.now();
        
        // 로컬 상태 업데이트용
        const newSets: OptionSet[] = [];
        const newOptions: Record<string, Option[]> = {};
        const newCategoryDraft: Record<string, ReportCategory> = {};

        for (const setData of template.data!) {
          const { data: newSet, error: setError } = await supabase
            .from('feed_option_sets')
            .insert({
              config_id: cfg.id,
              tenant_id: tenantId,
              name: setData.name,
              set_key: `${setData.set_key}_${timestamp}`,
              category: setData.name,
              is_scored: setData.is_scored,
              score_step: setData.score_step ?? null,
              default_report_category: setData.report_category ?? 'study',
              is_active: true,
            })
            .select('*')
            .single();

          if (setError || !newSet) {
            toastSaveFail();
            return;
          }

          const createdOptions: Option[] = [];
          
          for (let i = 0; i < setData.options.length; i++) {
            const { data: newOpt, error: optError } = await supabase
              .from('feed_options')
              .insert({
                set_id: newSet.id,
                label: setData.options[i].label,
                score: setData.options[i].score,
                display_order: i,
                is_active: true,
                report_category: setData.report_category ?? 'study',
              })
              .select('*')
              .single();

            if (optError) {
              toastSaveFail();
              return;
            }
            
            if (newOpt) {
              createdOptions.push(newOpt as Option);
            }
          }
          
          newSets.push(newSet as OptionSet);
          newOptions[newSet.id] = createdOptions;
          newCategoryDraft[newSet.id] = (setData.report_category ?? 'study') as ReportCategory;
        }

        // 로컬 상태 직접 업데이트 (loadOptionSets 대신)
        setOptionSets(newSets);
        setOptions(newOptions);
        setCategoryDraft(newCategoryDraft);
        setExpandedSets(new Set());
        
        toast.success('템플릿이 적용되었습니다');
        setShowWizard(false);
        setWizardStep('template');
      } catch {
        toast.error('시스템 오류');
      }
    },
    [archiveAllCurrentSets, ensureActiveConfig, getTenantId, setExpandedSets, supabase, toastSaveFail]
  );

  const setCustomTemplate = useCallback(
    (scoringType: Exclude<TemplateType, null>) => {
      setCurrentTemplate(scoringType);
      setShowWizard(false);
      setWizardStep('template');

      toast.success(`${TEMPLATE_TYPE_LABEL[scoringType]} 템플릿이 선택되었습니다`);
    },
    []
  );

  const addItemWithTemplate = useCallback(
    async (
      template: Exclude<TemplateType, null>,
      itemName: string,
      itemCategory: ReportCategory
    ): Promise<OptionSet | null> => {
      try {
        const cfg = await ensureActiveConfig();

        const tenantId = await getTenantId();
        if (!tenantId) {
          toast.error('tenant_id 없음');
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
          precise: { is_scored: true, score_step: SCORE_STEP.PRECISE },
          general: { is_scored: true, score_step: SCORE_STEP.GENERAL },
          text: { is_scored: false, score_step: null },
        } as const;

        const config = templateConfig[template];
        const timestamp = Date.now();
        const safeKey = `cat_${timestamp}`;

        let attempts = 0;
        let created: OptionSet | null = null;

        while (!created && attempts < MAX_RETRY_ATTEMPTS) {
          attempts++;
          const attemptName = attempts === 1 ? finalName : `${finalName} (${attempts})`;

          const { data, error } = await supabase
            .from('feed_option_sets')
            .insert({
              config_id: cfg.id,
              tenant_id: tenantId,
              name: attemptName,
              set_key: `${safeKey}_${attempts}`,
              category: attemptName,
              is_scored: config.is_scored,
              score_step: config.score_step,
              is_active: true,
              default_report_category: itemCategory,
            })
            .select('*')
            .single();

          if (!error && data) {
            created = data as OptionSet;
            setCurrentTemplate(template);
            toast.success(`'${attemptName}' 평가항목이 추가되었습니다`);
          } else if (error) {
            if (!error.message?.toLowerCase().includes('duplicate')) {
              toastSaveFail();
              return null;
            }
          }
        }

        if (!created) {
          toast.error('추가 실패: 이름 중복이 계속 발생했습니다');
          return null;
        }

        // 로컬 상태 직접 업데이트 (loadOptionSets 대신)
        setOptionSets((prev) => [...prev, created!]);
        setOptions((prev) => ({ ...prev, [created!.id]: [] }));
        setCategoryDraft((prev) => ({ ...prev, [created!.id]: itemCategory }));
        setExpandedSets(new Set([created.id]));

        return created;
      } catch {
        toast.error('시스템 오류가 발생했습니다');
        return null;
      }
    },
    [ensureActiveConfig, getTenantId, setExpandedSets, supabase, toastSaveFail]
  );

  // ========== Wizard Control ==========
  const openWizard = useCallback(() => {
    setShowWizard(true);
    setWizardStep('template');
  }, []);

  const closeWizard = useCallback(() => {
    setShowWizard(false);
    setWizardStep('template');
  }, []);

  // ========== Return ==========
  return {
    // State
    activeConfig,
    optionSets,
    options,
    categoryDraft,
    setCategoryDraft,
    currentTemplate,
    setCurrentTemplate,
    showWizard,
    setShowWizard,
    wizardStep,
    setWizardStep,
    isLoading, // ✅ 추가

    // Loaders
    loadOptionSets,
    loadActiveConfig,
    ensureActiveConfig,

    // Option CRUD
    handleOptionDragEnd,
    updateOption,
    deleteOption,
    addOptionFromInput,

    // Set CRUD
    toggleSetActive,
    deleteSet,
    updateSetName,
    changeSetCategory,
    duplicateSet,

    // Template
    archiveAllCurrentSets,
    applyTemplate,
    setCustomTemplate,
    addItemWithTemplate,

    // Wizard
    openWizard,
    closeWizard,
  };
}