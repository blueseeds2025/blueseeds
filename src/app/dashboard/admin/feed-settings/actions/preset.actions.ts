'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';
import type { OptionSet, Option } from '@/types/feed-settings';

// =======================
// Types
// =======================
type ActionResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; message: string };

// =======================
// Supabase Helper
// =======================
async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        },
      },
    }
  );
}

async function getTenantIdOrThrow(sb: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .single();

  if (profErr || !profile?.tenant_id) {
    throw new Error('TENANT_NOT_FOUND');
  }

  return { tenantId: profile.tenant_id as string, userId: userData.user.id };
}

// =======================
// Utility
// =======================
const clip = (v: unknown, max: number) => {
  const s = (v ?? '').toString();
  return s.length > max ? s.slice(0, max) : s;
};

const makeShortSuffix = () => {
  const a = Date.now().toString(36).slice(-6);
  const b = Math.random().toString(36).slice(2, 6);
  return `${a}${b}`;
};

// =======================
// Save Preset
// =======================
export async function saveFeedPreset(params: {
  name: string;
  optionSets: OptionSet[];
  optionsBySet: Record<string, Option[]>;
}): Promise<ActionResult<{ presetId: string }>> {
  try {
    const sb = await supabaseServer();
    const { tenantId, userId } = await getTenantIdOrThrow(sb);

    const name = params.name.trim();
    if (!name) {
      return { ok: false, message: '프리셋 이름을 입력하세요' };
    }
    if (!params.optionSets || params.optionSets.length === 0) {
      return { ok: false, message: '저장할 평가항목이 없습니다' };
    }

    // 1. 프리셋 헤더 생성
    const { data: preset, error: presetErr } = await sb
      .from('feed_presets')
      .insert({ tenant_id: tenantId, name, created_by: userId })
      .select('id')
      .single();

    if (presetErr || !preset?.id) {
      if ((presetErr as any)?.code === '23505') {
        return { ok: false, message: '이미 같은 이름의 프리셋이 있습니다' };
      }
      return { ok: false, message: presetErr?.message ?? '프리셋 생성 실패' };
    }

    const presetId = preset.id;

    try {
      // 2. 세트 저장
      const setRows = params.optionSets.map((s, idx) => ({
        preset_id: presetId,
        name: s.name,
        set_key: s.set_key ?? `set_${idx}`,
        is_scored: !!s.is_scored,
        score_step: s.score_step ?? null,
       default_report_category: (s.default_report_category ?? 'EVALUATION') as any,
        display_order: idx,
      }));

      const { error: setInsertErr } = await sb.from('feed_preset_sets').insert(setRows);
      if (setInsertErr) throw setInsertErr;

      // 3. 저장된 세트 ID 조회
      const { data: insertedSets, error: setSelectErr } = await sb
        .from('feed_preset_sets')
        .select('id, display_order')
        .eq('preset_id', presetId)
        .order('display_order');

      if (setSelectErr || !insertedSets) throw setSelectErr ?? new Error('세트 조회 실패');

      const mapByOrder = new Map<number, string>();
      for (const row of insertedSets as any[]) {
        mapByOrder.set(row.display_order, row.id);
      }

      // 4. 옵션 저장
      const optionRows: any[] = [];
      params.optionSets.forEach((s, idx) => {
        const presetSetId = mapByOrder.get(idx);
        if (!presetSetId) return;

        const opts = params.optionsBySet?.[s.id] ?? [];
        opts.forEach((o, j) => {
          optionRows.push({
            preset_set_id: presetSetId,
            label: o.label,
            score: o.score ?? null,
            report_category: (o.report_category ?? s.default_report_category ?? 'EVALUATION') as any,
            display_order: o.display_order ?? j,
          });
        });
      });

      if (optionRows.length > 0) {
        const { error: optInsertErr } = await sb.from('feed_preset_options').insert(optionRows);
        if (optInsertErr) throw optInsertErr;
      }

      return { ok: true, data: { presetId } };
    } catch (e) {
      // 롤백: cascade delete
      await sb.from('feed_presets').delete().eq('id', presetId);
      console.error('[saveFeedPreset] rollback:', e);
      return { ok: false, message: '저장 중 오류가 발생했습니다' };
    }
  } catch (e) {
    console.error('[saveFeedPreset] fatal:', e);
    return { ok: false, message: (e as Error)?.message ?? '서버 오류' };
  }
}

// =======================
// List Presets (N+1 해결)
// =======================
type PresetSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  setCount: number;
  optionCount: number;
};

export async function listFeedPresets(): Promise<PresetSummary[]> {
  const sb = await supabaseServer();
  const { tenantId } = await getTenantIdOrThrow(sb);

  // 1. 프리셋 목록
  const { data: presets, error: presetErr } = await sb
    .from('feed_presets')
    .select('id, name, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });

  if (presetErr) {
    console.error('[listFeedPresets] error:', presetErr);
    throw presetErr;
  }

  if (!presets || presets.length === 0) {
    return [];
  }

  const presetIds = presets.map((p) => p.id);

  // 2. 모든 세트 한 번에 로드 (N+1 해결)
  const { data: allSets, error: setErr } = await sb
    .from('feed_preset_sets')
    .select('id, preset_id')
    .in('preset_id', presetIds);

  if (setErr) {
    console.error('[listFeedPresets] set error:', setErr);
    throw setErr;
  }

  const sets = allSets ?? [];
  const setIds = sets.map((s) => s.id);

  // 3. 모든 옵션 카운트 한 번에 로드 (N+1 해결)
  let optionCounts: Record<string, number> = {};

  if (setIds.length > 0) {
    const { data: allOptions, error: optErr } = await sb
      .from('feed_preset_options')
      .select('preset_set_id')
      .in('preset_set_id', setIds);

    if (optErr) {
      console.error('[listFeedPresets] option error:', optErr);
      throw optErr;
    }

    // preset_set_id별 카운트
    for (const opt of allOptions ?? []) {
      optionCounts[opt.preset_set_id] = (optionCounts[opt.preset_set_id] ?? 0) + 1;
    }
  }

  // 4. preset별로 집계
  const setCountByPreset: Record<string, number> = {};
  const optionCountByPreset: Record<string, number> = {};

  for (const set of sets) {
    const presetId = set.preset_id;
    setCountByPreset[presetId] = (setCountByPreset[presetId] ?? 0) + 1;
    optionCountByPreset[presetId] = (optionCountByPreset[presetId] ?? 0) + (optionCounts[set.id] ?? 0);
  }

  // 5. 결과 조합
  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    updated_at: p.updated_at,
    setCount: setCountByPreset[p.id] ?? 0,
    optionCount: optionCountByPreset[p.id] ?? 0,
  }));
}

// =======================
// Apply Preset
// =======================
export async function applyFeedPreset(presetId: string): Promise<ActionResult> {
  const createdSetIds: string[] = [];
  let sb: Awaited<ReturnType<typeof supabaseServer>> | null = null;

  try {
    sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    if (!presetId) {
      return { ok: false, message: '프리셋 ID가 필요합니다' };
    }

    // 1. active config 가져오거나 생성
    const { data: cfg, error: cfgErr } = await sb
      .from('feed_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    if (cfgErr) {
      return { ok: false, message: cfgErr.message };
    }

    let activeConfig: any = cfg;

    if (!activeConfig) {
      const { data: created, error: createErr } = await sb
        .from('feed_configs')
        .insert({
          tenant_id: tenantId,
          name: '기본 설정 V1',
          is_active: true,
          applied_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (createErr || !created) {
        return { ok: false, message: createErr?.message ?? '설정 생성 실패' };
      }
      activeConfig = created;
    }

    // 2. 현재 config의 세트 전부 보관 처리
    const { data: currentSets, error: setLoadErr } = await sb
      .from('feed_option_sets')
      .select('id')
      .eq('config_id', activeConfig.id)
      .is('deleted_at', null);

    if (setLoadErr) {
      return { ok: false, message: setLoadErr.message };
    }

    const currentSetIds = (currentSets ?? []).map((x: any) => x.id);

    if (currentSetIds.length > 0) {
      const { error: archiveErr } = await sb
        .from('feed_option_sets')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .in('id', currentSetIds);

      if (archiveErr) {
        return { ok: false, message: archiveErr.message };
      }

      const { error: optOffErr } = await sb
        .from('feed_options')
        .update({ is_active: false })
        .in('set_id', currentSetIds);

      if (optOffErr) {
        return { ok: false, message: optOffErr.message };
      }
    }

    // 3. 프리셋 데이터 로드
    const { data: presetSets, error: presetSetErr } = await sb
      .from('feed_preset_sets')
      .select('*')
      .eq('preset_id', presetId)
      .order('display_order');

    if (presetSetErr) {
      return { ok: false, message: presetSetErr.message };
    }

    const sets = (presetSets ?? []) as any[];

    if (sets.length === 0) {
      return { ok: true }; // 빈 프리셋
    }

    // 4. 모든 프리셋 옵션 한번에 로드 (N+1 해결)
    const presetSetIds = sets.map((s: any) => s.id);
    const { data: allPresetOptions, error: allOptErr } = await sb
      .from('feed_preset_options')
      .select('*')
      .in('preset_set_id', presetSetIds)
      .order('display_order');

    if (allOptErr) {
      return { ok: false, message: allOptErr.message };
    }

    // preset_set_id별로 그룹핑
    const optionsByPresetSetId: Record<string, any[]> = {};
    for (const opt of allPresetOptions ?? []) {
      if (!optionsByPresetSetId[opt.preset_set_id]) {
        optionsByPresetSetId[opt.preset_set_id] = [];
      }
      optionsByPresetSetId[opt.preset_set_id].push(opt);
    }

    // 5. 세트/옵션 생성
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      let createdSet: any = null;
      const baseName = s.name as string;

      for (let attempt = 1; attempt <= 5; attempt++) {
        const nameToUse = attempt === 1 ? baseName : `${baseName} (${attempt})`;
        const suffix = `${makeShortSuffix()}${attempt}`;

        const { data: newSet, error: newSetErr } = await sb
          .from('feed_option_sets')
          .insert({
            config_id: activeConfig.id,
            tenant_id: tenantId,
            name: clip(nameToUse, 50),
            set_key: clip(`${s.set_key}_${suffix}`, 50),
            category: clip(nameToUse, 50),
            is_scored: s.is_scored,
            score_step: s.score_step ?? null,
            is_active: true,
           default_report_category: s.default_report_category ?? 'EVALUATION',
          })
          .select('*')
          .single();

        if (!newSetErr && newSet) {
          createdSet = newSet;
          createdSetIds.push(newSet.id);
          break;
        }

        const code = (newSetErr as any)?.code;
        const msg = newSetErr?.message?.toLowerCase?.() ?? '';
        const isDuplicate = code === '23505' || msg.includes('duplicate') || msg.includes('unique');

        if (!isDuplicate) {
          return { ok: false, message: newSetErr?.message ?? '세트 생성 실패' };
        }
      }

      if (!createdSet) {
        return { ok: false, message: '세트 생성 실패: 이름 중복' };
      }

      // 메모리에서 옵션 가져오기 (DB 조회 없음)
      const opts = optionsByPresetSetId[s.id] ?? [];

      if (opts.length > 0) {
        const inserts = opts.map((o: any, idx: number) => ({
          set_id: createdSet.id,
          tenant_id: tenantId,
          label: clip(o.label, 50),
          score: o.score ?? null,
          display_order: o.display_order ?? idx,
          is_active: true,
         report_category: o.report_category ?? (s.default_report_category ?? 'EVALUATION'),
        }));

        const { error: optInsertErr } = await sb.from('feed_options').insert(inserts);
        if (optInsertErr) {
          return { ok: false, message: optInsertErr.message };
        }
      }
    }

    return { ok: true };
  } catch (e: any) {
    console.error('[applyFeedPreset] fatal:', e);

    // 롤백
    try {
      if (sb && createdSetIds.length > 0) {
        await sb.from('feed_options').delete().in('set_id', createdSetIds);
        await sb.from('feed_option_sets').delete().in('id', createdSetIds);
      }
    } catch (rollbackErr) {
      console.error('[applyFeedPreset] rollback failed:', rollbackErr);
    }

    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}

// =======================
// Delete Preset
// =======================
export async function deleteFeedPreset(presetId: string): Promise<ActionResult> {
  try {
    const sb = await supabaseServer();
    const { tenantId } = await getTenantIdOrThrow(sb);

    if (!presetId) {
      return { ok: false, message: '프리셋 ID가 필요합니다' };
    }

    // 소유권 확인
    const { data: preset, error: presetErr } = await sb
      .from('feed_presets')
      .select('id, tenant_id')
      .eq('id', presetId)
      .single();

    if (presetErr) {
      return { ok: false, message: presetErr.message };
    }

    if (!preset || (preset as any).tenant_id !== tenantId) {
      return { ok: false, message: '권한이 없습니다' };
    }

    // 세트 ID 조회
    const { data: presetSets, error: setErr } = await sb
      .from('feed_preset_sets')
      .select('id')
      .eq('preset_id', presetId);

    if (setErr) {
      return { ok: false, message: setErr.message };
    }

    const presetSetIds = (presetSets ?? []).map((s: any) => s.id);

    // 옵션 삭제
    if (presetSetIds.length > 0) {
      const { error: optDelErr } = await sb
        .from('feed_preset_options')
        .delete()
        .in('preset_set_id', presetSetIds);

      if (optDelErr) {
        return { ok: false, message: optDelErr.message };
      }
    }

    // 세트 삭제
    const { error: setDelErr } = await sb
      .from('feed_preset_sets')
      .delete()
      .eq('preset_id', presetId);

    if (setDelErr) {
      return { ok: false, message: setDelErr.message };
    }

    // 프리셋 삭제
    const { error: presetDelErr } = await sb
      .from('feed_presets')
      .delete()
      .eq('id', presetId);

    if (presetDelErr) {
      return { ok: false, message: presetDelErr.message };
    }

    return { ok: true };
  } catch (e: any) {
    console.error('[deleteFeedPreset] fatal:', e);
    return { ok: false, message: e?.message ?? '서버 오류' };
  }
}