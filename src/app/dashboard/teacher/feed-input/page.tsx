import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FeedInputClient from './FeedInputClient';

export default async function FeedInputPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // 프로필 확인 (교사 또는 원장만 접근 가능)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (!profile || !['owner', 'teacher'].includes(profile.role)) {
    redirect('/dashboard');
  }
  
  return (
    <div>
      <FeedInputClient />
    </div>
  );
}
