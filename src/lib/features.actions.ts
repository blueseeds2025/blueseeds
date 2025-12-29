'use server';

import { createClient } from '@/lib/supabase/server';
import { FEATURES, FeatureKey } from './features';
import { getAuthProfile } from './supabase';
// ============================================================================
// 서버용 기능 체크 함수
// ============================================================================

// 유효한 feature key 목록
const VALID_FEATURE_KEYS = Object.values(FEATURES);

/**
 * featureKey 유효성 검증
 */
function isValidFeatureKey(key: string): key is FeatureKey {
  return VALID_FEATURE_KEYS.includes(key as FeatureKey);
}

/**
 * 테넌트의 활성화된 기능 목록 조회
 */
export async function getTenantFeatures(): Promise<{
  success: boolean;
  features?: string[];
  error?: string;
}> {
  try {
    const authResult = await getAuthProfile();
    if (!authResult.success || !authResult.data) {
      return { success: false, error: authResult.error };
    }
    
    const supabase = await createClient();
    const { data: features, error } = await supabase
      .from('tenant_features')
      .select('feature_key')
      .eq('tenant_id', authResult.data.tenantId)
      .eq('is_enabled', true)
      .is('deleted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()');
    
    if (error) throw error;
    
    return {
      success: true,
      features: features?.map(f => f.feature_key) || [],
    };
  } catch (error) {
    console.error('getTenantFeatures error:', error);
    return { success: false, error: '기능 목록을 불러오는데 실패했습니다' };
  }
}

/**
 * 특정 기능이 활성화되어 있는지 서버에서 확인
 */
export async function checkFeature(featureKey: FeatureKey): Promise<boolean> {
  try {
    // 유효한 키인지 검증
    if (!isValidFeatureKey(featureKey)) {
      console.warn('Invalid feature key:', featureKey);
      return false;
    }
    
    const authResult = await getAuthProfile();
    if (!authResult.success || !authResult.data) {
      return false;
    }
    
    const supabase = await createClient();
    const { data } = await supabase
      .from('tenant_features')
      .select('id')
      .eq('tenant_id', authResult.data.tenantId)
      .eq('feature_key', featureKey)
      .eq('is_enabled', true)
      .is('deleted_at', null)
      .or('expires_at.is.null,expires_at.gt.now()')
      .single();
    
    return !!data;
  } catch {
    return false;
  }
}

/**
 * 기능 접근 차단 로그 기록
 */
export async function logFeatureBlock(
  featureKey: FeatureKey,
  reason?: string,
  pagePath?: string
): Promise<void> {
  try {
    // 유효한 키인지 검증
    if (!isValidFeatureKey(featureKey)) {
      console.warn('Invalid feature key for logging:', featureKey);
      return;
    }
    
    const authResult = await getAuthProfile();
    if (!authResult.success || !authResult.data) return;
    
    const supabase = await createClient();
    await supabase
      .from('feature_access_logs')
      .insert({
        tenant_id: authResult.data.tenantId,
        user_id: authResult.data.userId,
        feature_key: featureKey,
        action: 'blocked',
        reason,
        page_path: pagePath,
      });
  } catch (error) {
    // 로그 실패는 무시 (핵심 기능 아님)
    console.error('logFeatureBlock error:', error);
  }
}

/**
 * 기능 접근 시도 로그 (성공/실패 모두)
 */
export async function logFeatureAccess(
  featureKey: FeatureKey,
  action: 'allowed' | 'blocked',
  reason?: string,
  pagePath?: string
): Promise<void> {
  try {
    // 유효한 키인지 검증
    if (!isValidFeatureKey(featureKey)) {
      console.warn('Invalid feature key for logging:', featureKey);
      return;
    }
    
    const authResult = await getAuthProfile();
    if (!authResult.success || !authResult.data) return;
    
    const supabase = await createClient();
    await supabase
      .from('feature_access_logs')
      .insert({
        tenant_id: authResult.data.tenantId,
        user_id: authResult.data.userId,
        feature_key: featureKey,
        action,
        reason,
        page_path: pagePath,
      });
  } catch (error) {
    console.error('logFeatureAccess error:', error);
  }
}
