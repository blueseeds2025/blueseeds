import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FeedInputClient from './FeedInputClient';

export default async function FeedInputPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // 프로필 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id')
    .eq('id', user.id)
    .single();
  
  if (!profile || !['owner', 'teacher'].includes(profile.role)) {
    redirect('/dashboard');
  }
  
  let classes: { id: string; name: string }[] = [];
  
  // 원장은 모든 반, 교사는 담당 반만
  if (profile.role === 'owner') {
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id, name')
      .eq('tenant_id', profile.tenant_id)
      .order('name');
    
    classes = allClasses || [];
  } else {
    // 교사 담당 반
    const { data: teacherClasses } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', user.id);
    
    const classIds = (teacherClasses || []).map(tc => tc.class_id);
    
    if (classIds.length > 0) {
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .in('id', classIds)
        .order('name');
      
      classes = classData || [];
    }
  }
  
  return (
    <div>
      <FeedInputClient 
        initialClasses={classes}
        teacherId={user.id}
        tenantId={profile.tenant_id}
      />
    </div>
  );
}