-- ============================================
-- 선제 방어용 DB 제약조건 추가
-- 2024-12-29
-- ============================================

-- 1) display_code 동시성 방어 (레이스 컨디션)
-- 동시 생성 시 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS students_tenant_display_code_unique 
ON students (tenant_id, display_code) 
WHERE deleted_at IS NULL;

-- 2) class_members 중복 등록 방지
-- 같은 학생이 같은 반에 두 번 등록되는 것 방지
CREATE UNIQUE INDEX IF NOT EXISTS class_members_unique_enrollment
ON class_members (tenant_id, class_id, student_id)
WHERE deleted_at IS NULL;

-- 3) class_teachers 중복 배정 방지
-- 같은 선생님이 같은 반에 두 번 배정되는 것 방지
CREATE UNIQUE INDEX IF NOT EXISTS class_teachers_unique_assignment
ON class_teachers (tenant_id, class_id, teacher_id)
WHERE deleted_at IS NULL;
