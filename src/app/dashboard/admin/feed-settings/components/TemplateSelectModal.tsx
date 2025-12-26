'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { feedStyles } from '@/styles/feedSettings.styles';

type Props = {
  open: boolean;
  pendingItemName: string;

  onSelectPrecise: () => void;
  onSelectGeneral: () => void;
  onSelectText: () => void;

  onClose: () => void;
};

export default function TemplateSelectModal({
  open,
  pendingItemName,
  onSelectPrecise,
  onSelectGeneral,
  onSelectText,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <Card className={`${feedStyles.card.modal} border-[#6366F1]`}>
      <CardHeader>
        <CardTitle className={feedStyles.layout.modalTitleRow}>
          <Info className="w-5 h-5 text-[#6366F1]" />
          평가 방식을 선택해주세요
        </CardTitle>

        <p className={feedStyles.text.modalDescription}>
          '{pendingItemName}' 항목을 어떤 방식으로 평가하시겠습니까?
        </p>
      </CardHeader>

      <CardContent>
        <div className={feedStyles.layout.scoringGrid}>
          <Button 
            variant="outline" 
            className="h-16 flex flex-col gap-1 border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF]" 
            onClick={onSelectPrecise}
          >
            <span className="font-semibold text-[#37352F]">5점 단위</span>
            <span className="text-xs text-[#9B9A97]">정밀 평가</span>
          </Button>

          <Button 
            variant="outline" 
            className="h-16 flex flex-col gap-1 border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF]" 
            onClick={onSelectGeneral}
          >
            <span className="font-semibold text-[#37352F]">10점 단위</span>
            <span className="text-xs text-[#9B9A97]">일반 평가</span>
          </Button>

          <Button 
            variant="outline" 
            className="h-16 flex flex-col gap-1 border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF]" 
            onClick={onSelectText}
          >
            <span className="font-semibold text-[#37352F]">문장형</span>
            <span className="text-xs text-[#9B9A97]">점수 없음</span>
          </Button>
        </div>

        <Button variant="ghost" className="w-full mt-4" onClick={onClose}>
          취소
        </Button>
      </CardContent>
    </Card>
  );
}