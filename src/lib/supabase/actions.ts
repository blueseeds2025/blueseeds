'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

// ============================================================================
// Types
// ============================================================================

export type SupabaseServerClient = Awaited<ReturnType<typeof supabaseServer>>;

// ============================================================================
// Supabase Server Client
// ============================================================================

/**
 * Server Action에서 사용할 Supabase 클라이언트
 * 쿠키 기반 인증을 사용하여 현재 로그인한 사용자의 권한으로 작동
 */
export async function supabaseServer() {
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

// ============================================================================
// Auth Helpers
// ============================================================================

/**
 * 현재 사용자의 tenant_id를 가져옴
 * 인증되지 않았거나 tenant가 없으면 throw
 * 
 * @example
 * const sb = await supabaseServer();
 * const { tenantId, userId } = await getTenantIdOrThrow(sb);
 */
export async function getTenantIdOrThrow(sb: SupabaseServerClient) {
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

  return { 
    tenantId: profile.tenant_id as string, 
    userId: userData.user.id 
  };
}

/**
 * 현재 사용자의 tenant_id를 가져옴 (에러 대신 null 반환)
 * 
 * @example
 * const sb = await supabaseServer();
 * const tenantId = await getTenantIdSafe(sb);
 * if (!tenantId) return { ok: false, message: '인증 필요' };
 */
export async function getTenantIdSafe(sb: SupabaseServerClient): Promise<string | null> {
  try {
    const { tenantId } = await getTenantIdOrThrow(sb);
    return tenantId;
  } catch {
    return null;
  }
}

/**
 * 현재 사용자 정보를 가져옴
 */
export async function getCurrentUser(sb: SupabaseServerClient) {
  const { data: userData, error } = await sb.auth.getUser();
  if (error || !userData.user) {
    return null;
  }
  return userData.user;
}
