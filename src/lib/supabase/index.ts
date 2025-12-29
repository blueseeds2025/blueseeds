// ============================================================================
// Supabase 통합 모듈
// 
// 사용법:
// import { createClient, requireAuth } from '@/lib/supabase';
// ============================================================================

// 클라이언트 생성
export { createClient, createClient as supabaseServer, createAdminClient, type SupabaseServerClient } from './server';
// 인증 헬퍼
export { 
  requireAuth,
  requireAuthWithClient,
  requireOwner,
  getAuthSafe,
  getTenantIdSafe,
  isOwner,
  // 레거시 호환
  getTenantIdOrThrow,
  getAuthProfile,
  type AuthProfile,
} from './auth';

// 타입
export type { Database, Json } from './types';
