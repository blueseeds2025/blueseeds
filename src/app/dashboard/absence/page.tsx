import { createClient } from '@/lib/supabase/server';
import MakeupManagePage from './MakeupManagePage';

export default async function Page() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  let role: 'owner' | 'teacher' = 'teacher';
  
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role === 'owner') {
      role = 'owner';
    }
  }
  
  return <MakeupManagePage role={role} />;
}
