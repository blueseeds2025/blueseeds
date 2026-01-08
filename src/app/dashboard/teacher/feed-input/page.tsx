import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FeedInputClient from './FeedInputClient';
import { fetchFeedSettings } from './cached-feed-settings';
import { getFeedPageData } from './actions/feed-query.actions';

// ============================================================================
// Server Component - 설정 + 동적 데이터 조회
// ============================================================================

export default async function FeedInputPage() {
  const supabase = await createClient();
  
  // 1. 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }
  
  // 2. 프로필 확인
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, tenant_id')
    .eq('id', user.id)
    .single();
  
  if (profileError || !profile || !['owner', 'teacher'].includes(profile.role)) {
    redirect('/dashboard');
  }
  
  const role = profile.role as 'owner' | 'teacher';
  const tenantId = profile.tenant_id;
  
  // 3. 정적 데이터 조회 (supabase client 전달)
  const settings = await fetchFeedSettings(supabase, tenantId, user.id, role);
  
  // 4. 초기 반/날짜 결정
  const today = new Date().toISOString().split('T')[0];
  const initialClassId = settings.classes[0]?.id || '';
  const initialDate = today;
  
  // 5. 동적 데이터 조회
  let initialFeedData = {
    students: [] as Awaited<ReturnType<typeof getFeedPageData>>['data'] extends infer T ? T extends { students: infer S } ? S : never : never,
    savedFeeds: {} as Record<string, unknown>,
    previousProgressMap: {} as Record<string, string>,
    previousProgressEntriesMap: {} as Record<string, unknown[]>,
  };
  
  if (initialClassId) {
    const feedDataResult = await getFeedPageData(
      initialClassId,
      initialDate,
      settings.tenantSettings.progress_enabled,
      settings.textbooks.length > 0
    );
    
    if (feedDataResult.success && feedDataResult.data) {
      initialFeedData = feedDataResult.data;
    }
  }
  
  // 6. 클라이언트에 전달
  return (
    <div>
      <FeedInputClient 
        // 정적 데이터
        initialClasses={settings.classes}
        initialOptionSets={settings.optionSets}
        initialExamTypes={settings.examTypes}
        initialTextbooks={settings.textbooks}
        initialTenantSettings={settings.tenantSettings}
        // 동적 데이터
        initialClassId={initialClassId}
        initialDate={initialDate}
        initialStudents={initialFeedData.students}
        initialSavedFeeds={initialFeedData.savedFeeds}
        initialPreviousProgressMap={initialFeedData.previousProgressMap}
        initialPreviousProgressEntriesMap={initialFeedData.previousProgressEntriesMap}
        // 사용자 정보
        teacherId={user.id}
        tenantId={tenantId}
      />
    </div>
  );
}
