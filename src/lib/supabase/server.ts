import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types';

// ============================================================================
// Types
// ============================================================================

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ============================================================================
// Server Client (일반 사용자 권한)
// ============================================================================

/**
 * 서버에서 사용할 Supabase 클라이언트
 * 쿠키 기반 인증을 사용하여 현재 로그인한 사용자의 권한으로 작동
 * 
 * @example
 * const supabase = await createClient();
 * const { data } = await supabase.from('students').select('*');
 */
export async function createClient() {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서는 쿠키 설정이 불가능할 수 있음
          }
        },
      },
    }
  );
}

// ============================================================================
// Admin Client (Service Role - RLS 우회)
// ============================================================================

/**
 * Service Role을 사용하는 관리자 클라이언트
 * ⚠️ 주의: RLS를 우회하므로 매우 신중하게 사용!
 * 
 * @example
 * const adminClient = await createAdminClient();
 * // 모든 테넌트의 데이터에 접근 가능 - 위험!
 */
export async function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Service role key is not configured');
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
