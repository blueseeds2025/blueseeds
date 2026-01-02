export type TemplateType = 'precise' | 'general' | 'text' | null;

// ✅ export 추가 + 대문자로 통일
export type ReportCategory = 
  | 'VOCAB'
  | 'HOMEWORK'
  | 'ATTITUDE'
  | 'COMPREHENSION'
  | 'PROGRESS'
  | 'UNCATEGORIZED'
  | 'EVALUATION'
  | 'EXCLUDED'  
  | 'none';

export interface FeedConfig {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  applied_at: string | null;
  deleted_at: string | null;
}

export interface OptionSet {
  id: string;
  tenant_id: string;
  config_id: string | null;
  name: string;
  set_key: string;
  category: string;
  is_scored: boolean;
  score_step: number | null;
  is_active: boolean;
  deleted_at: string | null;
  default_report_category?: ReportCategory;
  // 주간 리포트 설정
  is_in_weekly_stats?: boolean;
  stats_category?: string | null;
}

export interface Option {
  id: string;
  set_id: string;
  label: string;
  score: number | null;
  display_order: number;
  is_active: boolean;
  deleted_at: string | null;
  report_category: ReportCategory;
}

// =======================
// Templates
// =======================
export type FeedTemplateKey = 'custom' | 'basic' | 'english' | 'text';

export interface TemplateOptionData {
  label: string;
  score: number | null;
}

export interface TemplateSetData {
  name: string;
  set_key: string;
  is_scored: boolean;
  score_step: number | null;
  report_category: ReportCategory;
  options: TemplateOptionData[];
}

export interface FeedTemplate {
  name: string;
  description: string;
  data?: TemplateSetData[];
}