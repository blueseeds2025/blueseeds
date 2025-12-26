'use client';

import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
};

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    options: { title: '', description: '' },
    onConfirm: () => {},
    onCancel: () => {},
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        options,
        onConfirm: () => {
          setState((prev) => ({ ...prev, open: false }));
          resolve(true);
        },
        onCancel: () => {
          setState((prev) => ({ ...prev, open: false }));
          resolve(false);
        },
      });
    });
  }, []);

  const ConfirmDialog = () => (
    <AlertDialog open={state.open} onOpenChange={(isOpen) => !isOpen && state.onCancel()}>
      <AlertDialogContent className="border-[#E8E5E0]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#37352F]">{state.options.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-[#9B9A97]">
            {state.options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={state.onCancel}
            className="border-[#E8E5E0] text-[#37352F] hover:bg-[#F7F6F3]"
          >
            {state.options.cancelLabel || '취소'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={state.onConfirm}
            className={state.options.variant === 'danger' 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-[#6366F1] hover:bg-[#4F46E5]'
            }
          >
            {state.options.confirmLabel || '확인'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}