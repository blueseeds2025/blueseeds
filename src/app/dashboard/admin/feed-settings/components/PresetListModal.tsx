'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, Trash2 } from 'lucide-react';
import { feedStyles } from '@/styles/feedSettings.styles';

type PresetSummary = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  setCount: number;
  optionCount: number;
};

type Props = {
  open: boolean;
  onClose: () => void;

  presets: PresetSummary[];

  applyingPresetId: string | null;
  deletingPresetId: string | null;

  onApply: (presetId: string, presetName: string) => void;
  onDelete: (presetId: string, presetName: string) => void;
};

export default function PresetListModal({
  open,
  onClose,
  presets,
  applyingPresetId,
  deletingPresetId,
  onApply,
  onDelete,
}: Props) {
  if (!open) return null;

  const isApplying = applyingPresetId !== null;
  const isDeleting = deletingPresetId !== null;

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <Card
        onMouseDown={(e) => e.stopPropagation()}
        className={`${feedStyles.card.modal} border-[#6366F1] w-full max-w-xl`}
      >
        <CardHeader>
          <CardTitle className={feedStyles.layout.modalTitleRow}>
            <Info className="w-5 h-5 text-[#6366F1]" />
            저장된 설정 불러오기
          </CardTitle>
          <p className={feedStyles.text.modalDescription}>
            저장된 설정 목록입니다. 적용할 구성을 선택하세요.
          </p>
        </CardHeader>

        <CardContent>
          {presets.length === 0 ? (
            <p className={feedStyles.text.emptyState}>저장된 설정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-[#E8E5E0] bg-white px-4 py-3 hover:border-[#6366F1] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-[#37352F]">{p.name}</div>
                    <div className="text-xs text-[#9B9A97]">
                      세트 {p.setCount}개 · 옵션 {p.optionCount}개
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                      disabled={isDeleting || isApplying}
                      onClick={() => onDelete(p.id, p.name)}
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <Button
                      type="button"
                      className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
                      disabled={isApplying || isDeleting}
                      onClick={() => onApply(p.id, p.name)}
                    >
                      {isApplying && applyingPresetId === p.id ? '적용 중…' : '적용'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              닫기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}