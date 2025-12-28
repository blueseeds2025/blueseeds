'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { styles } from '../constants';

type Props = {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => Promise<boolean>;
  onCancel: () => void;
};

export function DeleteConfirmModal({ 
  title, 
  message, 
  confirmText = '삭제',
  onConfirm, 
  onCancel 
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const success = await onConfirm();
      if (success) {
        onCancel();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-[#37352F] mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className={styles.button.secondary + ' flex-1'}
              disabled={isDeleting}
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className={styles.button.danger + ' flex-1'}
              disabled={isDeleting}
            >
              {isDeleting ? '처리 중...' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
