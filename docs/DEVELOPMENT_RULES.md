# 리드앤톡 개발 규칙

## 1. 데이터 정책

### 1.1 class_members (학생 반 등록)

**규칙: 재등록 = 기존 row UPDATE**

- 학생이 반을 그만두면 → `is_active = false`
- 학생이 다시 등록하면 → 기존 row의 `is_active = true`로 UPDATE
- 새 row INSERT 금지 (유니크 인덱스로 방어됨)

```typescript
// enrollStudentToClass() 로직
if (existing) {
  if (existing.is_active) return '이미 등록됨';
  // 재등록: UPDATE
  await update({ is_active: true });
} else {
  // 신규: INSERT
  await insert({ ... });
}
```

### 1.2 class_teachers (교사 반 배정)

**동일 규칙 적용**
- 재배정 = 기존 row UPDATE
- 새 row INSERT 금지

### 1.3 students (display_code)

**규칙: 충돌 시 최대 3회 재시도**

- display_code는 `S001, S002, ...` 순번 자동 생성
- 동시 생성 시 유니크 충돌 가능
- 충돌 발생 시 다시 마지막 순번 조회 후 재시도

```typescript
for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
  // 순번 생성 → INSERT 시도
  if (error.code === '23505') continue; // 재시도
  // 성공 또는 다른 에러면 종료
}
```

---

## 2. DB 제약조건

### 2.1 유니크 인덱스 목록

| 인덱스명 | 테이블 | 컬럼 | 조건 |
|---------|--------|------|------|
| `students_tenant_display_code_unique` | students | (tenant_id, display_code) | WHERE deleted_at IS NULL |
| `class_members_unique_enrollment` | class_members | (tenant_id, class_id, student_id) | WHERE deleted_at IS NULL |
| `class_teachers_unique_assignment` | class_teachers | (tenant_id, class_id, teacher_id) | WHERE deleted_at IS NULL |

### 2.2 soft delete 패턴

모든 주요 테이블은 `deleted_at` 컬럼 사용:
- 삭제 = `deleted_at = NOW()`
- 조회 시 항상 `WHERE deleted_at IS NULL`
- 유니크 인덱스도 `WHERE deleted_at IS NULL` 조건부

---

## 3. 권한 정책

### 3.1 teacher_feed_permissions (Premium)

**기본값: 허용 (deny-list 방식)**

- 권한 row가 없는 교사 → 모든 피드 세트 허용
- `is_allowed = false`인 세트만 숨김
- 절대로 "권한 없으면 전부 차단" 로직 금지

---

## 4. 운영 쿼리 안전 규칙

### 4.1 중복 데이터 정리 시

**반드시 tenant_id 필터 추가**

```sql
-- ❌ 위험: 전체 테이블 대상
UPDATE class_teachers SET deleted_at = NOW() WHERE ...

-- ✅ 안전: 특정 테넌트만
UPDATE class_teachers SET deleted_at = NOW() 
WHERE tenant_id = '특정-테넌트-ID' AND ...
```

---

## 5. is_active / deleted_at 사용 규칙

| 상태 | is_active | deleted_at |
|-----|-----------|------------|
| 활성 | true | NULL |
| 비활성 (일시 중단) | false | NULL |
| 삭제됨 | - | timestamp |

- **비활성**: 나중에 다시 활성화 가능 (재등록)
- **삭제됨**: 영구 삭제 (복구 불가, 유니크 제약에서 제외)

---

*최종 업데이트: 2024-12-29*
