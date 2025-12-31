'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';

type AllowedRole = 'owner' | 'teacher' | 'admin';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: AllowedRole[];
  fallbackUrl?: string;
}

/**
 * 페이지 레벨 role 가드
 * 
 * 사용법:
 * ```tsx
 * // admin 전용 페이지
 * <RoleGuard allowedRoles={['owner']}>
 *   <AdminPageContent />
 * </RoleGuard>
 * 
 * // teacher도 접근 가능한 페이지
 * <RoleGuard allowedRoles={['owner', 'teacher']}>
 *   <SharedPageContent />
 * </RoleGuard>
 * ```
 * 
 * ⚠️ 중요: 이 가드는 UI 차단일 뿐, 보안이 아님!
 * 서버 액션에서 반드시 role 체크를 해야 함.
 */
export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallbackUrl = '/dashboard' 
}: RoleGuardProps) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const router = useRouter();
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace('/auth/login');
        return;
      }
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!profile || !allowedRoles.includes(profile.role as AllowedRole)) {
        // 권한 없음 - fallback으로 리다이렉트
        router.replace(fallbackUrl);
        return;
      }
      
      setIsAuthorized(true);
    };
    
    checkRole();
  }, [allowedRoles, fallbackUrl, router]);

  // 로딩 중
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#6366F1]" />
          <p className="mt-3 text-gray-500">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  // 권한 없음 (리다이렉트 중)
  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
