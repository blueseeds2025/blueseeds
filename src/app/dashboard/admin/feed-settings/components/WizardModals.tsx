'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, BookOpen, Languages, Calculator } from 'lucide-react';
import { feedStyles } from '@/styles/feedSettings.styles';

type TemplateKey = 'custom' | 'basic' | 'english' | 'text';
type ScoringKey = 'precise' | 'general' | 'text';

type TemplateWizardProps = {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (key: TemplateKey) => void;
};

export function TemplateWizardModal({ open, onClose, onSelectTemplate }: TemplateWizardProps) {
  if (!open) return null;

  return (
    <Card className={`${feedStyles.card.modal} border-[#E8E5E0]`}>
      <CardHeader>
        <CardTitle className="text-[#37352F]">어떤 카테고리를 만드시겠습니까?</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={feedStyles.layout.templateGrid}>
          <Card
            className="cursor-pointer border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-all"
            onClick={() => onSelectTemplate('custom')}
          >
            <CardContent className={feedStyles.card.templateContent}>
              <Wrench className="w-8 h-8 mb-2 text-[#6366F1]" />
              <div className="font-semibold text-[#37352F]">직접 만들기</div>
              <div className="text-xs text-[#9B9A97]">빈 화면</div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-[#E8E5E0] hover:border-[#059669] hover:bg-[#D1FAE5]/30 transition-all"
            onClick={() => onSelectTemplate('basic')}
          >
            <CardContent className={feedStyles.card.templateContent}>
              <BookOpen className="w-8 h-8 mb-2 text-[#059669]" />
              <div className="font-semibold text-[#37352F]">기본형</div>
              <div className="text-xs text-[#9B9A97]">종합학원용</div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-[#E8E5E0] hover:border-[#7C3AED] hover:bg-[#EDE9FE]/30 transition-all"
            onClick={() => onSelectTemplate('english')}
          >
            <CardContent className={feedStyles.card.templateContent}>
              <Languages className="w-8 h-8 mb-2 text-[#7C3AED]" />
              <div className="font-semibold text-[#37352F]">영어형</div>
              <div className="text-xs text-[#9B9A97]">어학원용</div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-[#E8E5E0] hover:border-[#EA580C] hover:bg-[#FED7AA]/30 transition-all"
            onClick={() => onSelectTemplate('text')}
          >
            <CardContent className={feedStyles.card.templateContent}>
              <Calculator className="w-8 h-8 mb-2 text-[#EA580C]" />
              <div className="font-semibold text-[#37352F]">문장형</div>
              <div className="text-xs text-[#9B9A97]">점수 없음</div>
            </CardContent>
          </Card>
        </div>

        <Button variant="ghost" className="w-full mt-4" onClick={onClose}>
          닫기
        </Button>
      </CardContent>
    </Card>
  );
}

type ScoringWizardProps = {
  open: boolean;
  onBack: () => void;
  onSelectScoring: (key: ScoringKey) => void;
};

export function ScoringWizardModal({ open, onBack, onSelectScoring }: ScoringWizardProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onBack}
      />
      {/* 모달 콘텐츠 */}
      <Card className="relative z-10 w-full max-w-lg mx-4 border-[#6366F1] shadow-xl">
        <CardHeader>
          <CardTitle className="text-[#37352F]">평가 방식을 선택해주세요</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={feedStyles.layout.scoringGrid}>
            <Button 
              variant="outline" 
              className="h-16 border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF] text-[#37352F] font-medium"
              onClick={() => onSelectScoring('precise')}
            >
              5점 단위
            </Button>
            <Button 
              variant="outline" 
              className="h-16 border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF] text-[#37352F] font-medium"
              onClick={() => onSelectScoring('general')}
            >
              10점 단위
            </Button>
            <Button 
              variant="outline" 
              className="h-16 border-[#E8E5E0] hover:border-[#6366F1] hover:bg-[#EEF2FF] text-[#37352F] font-medium"
              onClick={() => onSelectScoring('text')}
            >
              문장형
            </Button>
          </div>

          <Button variant="ghost" className="w-full mt-4" onClick={onBack}>
            뒤로
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}