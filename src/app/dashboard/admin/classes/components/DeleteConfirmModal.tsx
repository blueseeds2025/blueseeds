'use client';

import { AlertTriangle } from 'lucide-react';
import { styles } from '../constants';

type Props = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export function DeleteConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = '삭제',
  onConfirm,
  onCancel,
  isLoading = false,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className={styles.modal.overlay} onClick={onCancel}>
      <div
        className={styles.modal.content}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 아이콘 */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </div>

        {/* 제목 */}
        <h3 className="text-lg font-semibold text-center text-[#37352F] mb-2">
          {title}
        </h3>

        {/* 메시지 */}
        <p className="text-sm text-gray-500 text-center mb-6">
          {message}
        </p>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            className={styles.button.secondary + ' flex-1'}
            onClick={onCancel}
            disabled={isLoading}
          >
            취소
          </button>
          <button
            className={styles.button.danger + ' flex-1'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
