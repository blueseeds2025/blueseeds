'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

import type { Class, ClassFormData } from '../types';
import { CLASS_COLORS, DEFAULT_CLASS_COLOR, styles } from '../constants';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClassFormData) => Promise<boolean>;
  editingClass?: Class | null;
};

export function ClassFormModal({ isOpen, onClose, onSubmit, editingClass }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_CLASS_COLOR);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editingClass;

  // 수정 모드일 때 기존 값 세팅
  useEffect(() => {
    if (editingClass) {
      setName(editingClass.name);
      setColor(editingClass.color);
    } else {
      setName('');
      setColor(DEFAULT_CLASS_COLOR);
    }
  }, [editingClass, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    setIsSubmitting(true);
    const success = await onSubmit({ name: name.trim(), color });
    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal.overlay} onClick={onClose}>
      <div
        className={styles.modal.content}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className={styles.modal.title}>
            {isEditing ? '반 수정' : '새 반 만들기'}
          </h2>
          <button
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit}>
          {/* 반 이름 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#37352F] mb-1">
              반 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 초등 3반, 중등 심화반"
              className={styles.input.base}
              autoFocus
            />
          </div>

          {/* 색상 선택 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#37352F] mb-2">
              색상 (시간표 표시용)
            </label>
            <div className="flex flex-wrap gap-2">
              {CLASS_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`
                    w-8 h-8 rounded-full transition-all
                    ${color === c.value 
                      ? 'ring-2 ring-offset-2 ring-[#6366F1] scale-110' 
                      : 'hover:scale-105'
                    }
                  `}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className={styles.button.secondary}
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.button.primary}
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? '저장 중...' : isEditing ? '수정' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
