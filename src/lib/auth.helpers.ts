'use server';

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// 공통 인증/프로필 헬퍼 함수
// ============================================================================

export interface ProfileWithTenant {
  userId: string;
  tenantId: string;
  role?: string;
}

/**
 * 현재 로그인한 사용자의 프로필과 tenant_id 조회
 * 모든 Server Action에서 공통으로 사용
 */
export async function getAuthProfile(): Promise<{
  success: boolean;
  data?: ProfileWithTenant;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '로그인이 필요합니다' };
    }
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();
    
    if (error || !profile?.tenant_id) {
      return { success: false, error: '프로필을 찾을 수 없습니다' };
    }
    
    return {
      success: true,
      data: {
        userId: user.id,
        tenantId: profile.tenant_id,
        role: profile.role,
      },
    };
  } catch (error) {
    console.error('getAuthProfile error:', error);
    return { success: false, error: '인증 정보를 확인하는데 실패했습니다' };
  }
}

/**
 * 현재 사용자가 owner 권한인지 확인
 */
export async function isOwner(): Promise<boolean> {
  const result = await getAuthProfile();
  return result.success && result.data?.role === 'owner';
}

/**
 * 현재 사용자의 tenant_id만 빠르게 조회
 */
export async function getTenantId(): Promise<string | null> {
  const result = await getAuthProfile();
  return result.success ? result.data?.tenantId ?? null : null;
}
