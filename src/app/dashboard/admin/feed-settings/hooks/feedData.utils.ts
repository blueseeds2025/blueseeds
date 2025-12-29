import type { OptionSet, Option, ReportCategory, TemplateType } from '@/types/feed-settings';
import { SCORE_STEP } from '../feedSettings.constants';

/**
 * 옵션 세트로부터 템플릿 타입 추론
 */
export function deriveTemplateFromSets(sets: OptionSet[]): TemplateType {
  if (sets.length === 0) return null;
  const first = sets[0];
  if (!first.is_scored) return 'text';
  if (first.score_step === SCORE_STEP.PRECISE) return 'precise';
  return 'general';
}

/**
 * 입력값에서 라벨과 점수 파싱
 * @example "좋음 +10" → { label: "좋음", score: 10 }
 * @example "나쁨" → { label: "나쁨", score: null }
 */
export function parseOptionInput(
  input: string,
  isScored: boolean,
  scoreStep: number
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
        
        if (!label) {
          label = score >= 0 ? `+${score}` : `${score}`;
        }
        
        // 스텝에 맞게 보정
        const correctedScore = Math.round(score / scoreStep) * scoreStep;
        if (correctedScore !== score) {
          score = correctedScore;
        }
      }
    }
  }

  return { label, score };
}

/**
 * 카테고리 드래프트 생성
 */
export function createCategoryDraft(sets: OptionSet[]): Record<string, ReportCategory> {
  const draft: Record<string, ReportCategory> = {};
  for (const set of sets) {
    draft[set.id] = (set.default_report_category ?? 'study') as ReportCategory;
  }
  return draft;
}

/**
 * 옵션을 setId별로 그룹핑
 */
export function groupOptionsBySetId(
  allOptions: Option[],
  setIds: string[]
): Record<string, Option[]> {
  const grouped: Record<string, Option[]> = {};
  for (const id of setIds) {
    grouped[id] = [];
  }
  for (const opt of allOptions) {
    if (grouped[opt.set_id]) {
      grouped[opt.set_id].push(opt);
    }
  }
  return grouped;
}

/**
 * 다음 display_order 계산
 */
export function getNextDisplayOrder(options: Option[]): number {
  if (options.length === 0) return 0;
  return Math.max(...options.map((o) => o.display_order)) + 1;
}

/**
 * 고유 set_key 생성
 */
export function generateSetKey(baseName: string): string {
  const timestamp = Date.now();
  const safeName = baseName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  return `${safeName}_${timestamp}`;
}
