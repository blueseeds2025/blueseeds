import { unstable_cache } from 'next/cache';

// ============================================================================
// 캐시 태그 생성 유틸리티
// ============================================================================

export const CacheTags = {
  // 피드 설정 (optionSets, examTypes, textbooks, tenantSettings)
  feedSettings: (tenantId: string) => `feed-settings:${tenantId}`,
  
  // 반 목록
  classes: (tenantId: string) => `classes:${tenantId}`,
  
  // 학생 목록 (반별)
  classStudents: (tenantId: string, classId: string) => `class-students:${tenantId}:${classId}`,
} as const;

// ============================================================================
// 캐시 생성 헬퍼
// ============================================================================

type CacheOptions = {
  tags: string[];
  revalidate?: number | false;
};

export function createCachedFn<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  keyParts: string[],
  options: CacheOptions
): T {
  return unstable_cache(
    fn,
    keyParts,
    {
      tags: options.tags,
      revalidate: options.revalidate ?? 3600, // 기본 1시간
    }
  ) as T;
}
