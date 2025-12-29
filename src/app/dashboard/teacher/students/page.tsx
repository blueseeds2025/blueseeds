import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TeacherStudentsClient from './TeacherStudentsClient';

export default async function TeacherStudentsPage() {
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
  
  // 담당 반 목록 조회
  let classes: { id: string; name: string; color: string }[] = [];
  
  if (profile.role === 'owner') {
    // 원장은 모든 반
    const { data: allClasses } = await supabase
      .from('classes')
      .select('id, name, color')
      .eq('tenant_id', profile.tenant_id)
      .is('deleted_at', null)
      .order('name');
    
classes = (allClasses || []).map(c => ({
  id: c.id,
  name: c.name,
  color: c.color ?? '#6366F1',
}));  } else {
    // 교사는 담당 반만
    const { data: teacherClasses } = await supabase
      .from('class_teachers')
      .select('class_id')
      .eq('teacher_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null);
    
    const classIds = (teacherClasses || []).map(tc => tc.class_id);
    
    if (classIds.length > 0) {
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name, color')
        .in('id', classIds)
        .is('deleted_at', null)
        .order('name');
      
classes = (classData || []).map(c => ({
  id: c.id,
  name: c.name,
  color: c.color ?? '#6366F1',
}));    }
  }
  
  return (
    <TeacherStudentsClient 
      initialClasses={classes}
      isOwner={profile.role === 'owner'}
    />
  );
}
