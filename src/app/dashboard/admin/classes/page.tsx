import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database }from '@/lib/supabase/types';

import ClassesClient from './ClassesClient';

export default async function ClassesPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server Component에서는 set이 필요 없으니 noop
        },
      },
    }
  );

  // 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  // 프로필 및 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/auth/login');
  
  // 원장만 접근 가능
  if (profile.role !== 'owner') redirect('/dashboard');

  return <ClassesClient />;
}
