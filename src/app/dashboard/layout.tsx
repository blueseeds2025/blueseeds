import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/server';
import { AuthProvider, AuthUser } from '@/lib/auth-context';
import { DashboardSidebar, DashboardContent } from './components/DashboardSidebar';

// ============================================================================
// 🆕 캐시 방지 - 사용자별 데이터가 섞이는 것 방지
// ============================================================================
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ============================================================================
// Server Component - 서버에서 인증 정보 조회
// ============================================================================

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // 서버에서 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }
  
  // 🆕 서버에서 프로필 조회 + error 처리
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('tenant_id, role, display_name')
    .eq('id', user.id)
    .single();
  
  // 🆕 error 또는 profile 없으면 리다이렉트
  if (error || !profile) {
    redirect('/auth/login');
  }
  
  // 🆕 role 런타임 검증 (캐스팅만 하면 위험)
  const role = profile.role;
  if (role !== 'owner' && role !== 'teacher') {
    redirect('/auth/login');
  }
  
  // AuthUser 객체 생성
  const authUser: AuthUser = {
    userId: user.id,
    tenantId: profile.tenant_id,
    role: role,  // 🆕 검증된 role 사용
    displayName: profile.display_name || '',
  };

  return (
    <AuthProvider user={authUser}>
      <div className="min-h-screen bg-gray-50 flex">
        {/* 클라이언트 사이드바 */}
        <DashboardSidebar />
        
        {/* 메인 콘텐츠 */}
        <DashboardContent>
          <Toaster position="top-center" richColors toastOptions={{ duration: 2000 }} />
          {children}
        </DashboardContent>
      </div>
    </AuthProvider>
  );
}
