import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * 서버 컴포넌트에서 사용할 Supabase 클라이언트
 * App Router의 Server Components에서 안전하게 사용
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // 서버 컴포넌트에서는 쿠키 설정이 불가능할 수 있음
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // 서버 컴포넌트에서는 쿠키 제거가 불가능할 수 있음
          }
        }
      }
    }
  )
}

/**
 * Service Role을 사용하는 관리자 클라이언트 (주의: 서버에서만 사용!)
 * 이 클라이언트는 RLS를 우회하므로 매우 신중하게 사용해야 함
 */
export function createAdminClient() {
  // Service role key가 있을 때만 사용
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Service role key is not configured')
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        get() { return undefined },
        set() {},
        remove() {}
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}