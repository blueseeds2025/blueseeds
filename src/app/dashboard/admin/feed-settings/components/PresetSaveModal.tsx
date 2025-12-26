'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { feedStyles } from '@/styles/feedSettings.styles';

type Props = {
  open: boolean;
  presetName: string;
  isSaving: boolean;

  onChangeName: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export default function PresetSaveModal({
  open,
  presetName,
  isSaving,
  onChangeName,
  onConfirm,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={onClose}
    >
      <div className="w-full max-w-md" onMouseDown={(e) => e.stopPropagation()}>
        <Card className={`${feedStyles.card.modal} border-[#6366F1]`}>
          <CardHeader>
            <CardTitle className={feedStyles.layout.modalTitleRow}>
              <Info className="w-5 h-5 text-[#6366F1]" />
              내 설정 저장
            </CardTitle>
            <p className={feedStyles.text.modalDescription}>
              현재 설정된 평가항목 구성을 저장합니다. 이름을 입력해주세요.
            </p>
          </CardHeader>

          <CardContent>
            <input
              className={feedStyles.input.base}
              placeholder="설정 이름 (예: 중등 내신 기간용)"
              value={presetName}
              onChange={(e) => onChangeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm();
              }}
              autoFocus
            />

            <div className={feedStyles.layout.modalActionRow}>
              <Button
                type="button"
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                disabled={!presetName.trim() || isSaving}
                onClick={onConfirm}
              >
                {isSaving ? '저장 중…' : '저장'}
              </Button>

              <Button type="button" variant="ghost" onClick={onClose}>
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}