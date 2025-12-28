'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

import type { Student, StudentFormData } from '../types';
import { GRADE_OPTIONS } from '../types';
import { styles } from '../constants';

type Props = {
  student?: Student | null;  // null이면 생성 모드
  onClose: () => void;
  onSubmit: (data: StudentFormData) => Promise<boolean>;
};

export function StudentFormModal({ student, onClose, onSubmit }: Props) {
  const isEditMode = !!student;
  
  const [formData, setFormData] = useState<StudentFormData>({
    name: '',
    parent_phone: '',
    student_phone: '',
    display_code: '',  // 백엔드에서 자동 생성
    school: '',
    grade: null,
    address: '',
    memo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormData, string>>>({});

  // 수정 모드일 때 초기값 설정
  useEffect(() => {
    if (student) {
      setFormData({
        name: student.name,
        parent_phone: student.parent_phone || student.phone || '',  // 기존 phone 호환
        student_phone: student.student_phone || '',
        display_code: student.display_code,
        school: student.school || '',
        grade: student.grade,
        address: student.address || '',
        memo: student.memo || '',
      });
    }
  }, [student]);

  // 유효성 검사
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof StudentFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력하세요';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      const success = await onSubmit(formData);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-[#E8E5E0]">
          <h2 className="text-lg font-semibold text-[#37352F]">
            {isEditMode ? '학생 정보 수정' : '새 학생 등록'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 이름 */}
          <div>
            <label className={styles.label}>
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className={errors.name ? styles.input.error : styles.input.base}
              placeholder="학생 이름"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* 학교 */}
          <div>
            <label className={styles.label}>학교</label>
            <input
              type="text"
              value={formData.school}
              onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
              className={styles.input.base}
              placeholder="예: 율하초등학교"
            />
          </div>

          {/* 학년 */}
          <div>
            <label className={styles.label}>학년</label>
            <select
              value={formData.grade ?? ''}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                grade: e.target.value ? Number(e.target.value) : null 
              }))}
              className={styles.input.base}
            >
              <option value="">선택 안 함</option>
              {GRADE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 보호자 연락처 */}
          <div>
            <label className={styles.label}>보호자 연락처</label>
            <input
              type="tel"
              value={formData.parent_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, parent_phone: e.target.value }))}
              className={styles.input.base}
              placeholder="010-0000-0000"
            />
          </div>

          {/* 학생 연락처 */}
          <div>
            <label className={styles.label}>학생 연락처</label>
            <input
              type="tel"
              value={formData.student_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, student_phone: e.target.value }))}
              className={styles.input.base}
              placeholder="010-0000-0000"
            />
          </div>

          {/* 주소 */}
          <div>
            <label className={styles.label}>주소</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className={styles.input.base}
              placeholder="예: 대구시 달서구 율하동"
            />
          </div>

          {/* 학생 특이사항 */}
          <div>
            <label className={styles.label}>학생 특이사항</label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
              className={styles.input.base + ' resize-none'}
              rows={4}
              placeholder="학습 이력, 레벨테스트 결과, 학부모 성향 등"
            />
            <p className="mt-1 text-xs text-gray-400">
              선생님들만 볼 수 있는 내부 메모입니다
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={styles.button.secondary + ' flex-1'}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.button.primary + ' flex-1'}
              disabled={isSubmitting}
            >
              {isSubmitting ? '저장 중...' : (isEditMode ? '수정' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
