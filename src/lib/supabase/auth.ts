import 'server-only';

import { createClient, type SupabaseServerClient } from './server';

// ============================================================================
// Types
// ============================================================================

export interface AuthProfile {
  userId: string;
  tenantId: string;
  role: 'owner' | 'teacher' | 'manager';
}

// ============================================================================
// 핵심 인증 함수 (단일 소스)
// ============================================================================

/**
 * 현재 로그인한 사용자의 인증 정보 조회
 * 모든 Server Action/Server Component에서 사용하는 단일 인증 함수
 * 
 * @throws 인증 실패 시 에러
 * 
 * @example
 * // Server Action에서
 * const { userId, tenantId, role } = await requireAuth();
 * 
 * // owner만 허용할 때
 * const auth = await requireAuth();
 * if (auth.role !== 'owner') throw new Error('권한 없음');
 */
export async function requireAuth(): Promise<AuthProfile> {
  const supabase = await createClient();
  return requireAuthWithClient(supabase);
}

/**
 * Supabase 클라이언트를 받아서 인증 정보 조회
 * 이미 클라이언트가 있을 때 사용 (재생성 방지)
 * 
 * @example
 * const supabase = await createClient();
 * const { tenantId, role } = await requireAuthWithClient(supabase);
 */
export async function requireAuthWithClient(supabase: SupabaseServerClient): Promise<AuthProfile> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  
  if (userErr || !userData.user) {
    throw new Error('NOT_AUTHENTICATED');
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userData.user.id)
    .single();

  if (profErr || !profile?.tenant_id) {
    throw new Error('TENANT_NOT_FOUND');
  }

  return {
    userId: userData.user.id,
    tenantId: profile.tenant_id as string,
    role: profile.role as 'owner' | 'teacher' | 'manager',
  };
}

// ============================================================================
// 편의 함수들
// ============================================================================

/**
 * owner 권한 필수 체크
 * owner가 아니면 에러 throw
 * 
 * @example
 * const { tenantId } = await requireOwner();
 */
export async function requireOwner(): Promise<AuthProfile> {
  const auth = await requireAuth();
  
  if (auth.role !== 'owner') {
    throw new Error('OWNER_REQUIRED');
  }
  
  return auth;
}

/**
 * 인증 정보 조회 (에러 대신 null 반환)
 * 
 * @example
 * const auth = await getAuthSafe();
 * if (!auth) return { ok: false, message: '로그인 필요' };
 */
export async function getAuthSafe(): Promise<AuthProfile | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

/**
 * tenant_id만 빠르게 조회 (에러 대신 null 반환)
 * 
 * @example
 * const tenantId = await getTenantIdSafe();
 */
export async function getTenantIdSafe(): Promise<string | null> {
  const auth = await getAuthSafe();
  return auth?.tenantId ?? null;
}

/**
 * 현재 사용자가 owner인지 확인
 * 
 * @example
 * if (await isOwner()) { ... }
 */
export async function isOwner(): Promise<boolean> {
  const auth = await getAuthSafe();
  return auth?.role === 'owner';
}

// ============================================================================
// 레거시 호환 (점진적 마이그레이션용)
// ============================================================================

/**
 * @deprecated requireAuthWithClient 사용 권장
 * 기존 코드 호환용
 */
export async function getTenantIdOrThrow(supabase: SupabaseServerClient) {
  const auth = await requireAuthWithClient(supabase);
  return { tenantId: auth.tenantId, userId: auth.userId };
}

/**
 * @deprecated requireAuth 사용 권장
 * 기존 코드 호환용
 */
export async function getAuthProfile(): Promise<{
  success: boolean;
  data?: AuthProfile;
  error?: string;
}> {
  try {
    const auth = await requireAuth();
    return { success: true, data: auth };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message === 'NOT_AUTHENTICATED' 
        ? '로그인이 필요합니다' 
        : '프로필을 찾을 수 없습니다' 
    };
  }
}
