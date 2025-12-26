'use client';

import { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { feedStyles } from '@/styles/feedSettings.styles';
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABEL } from '../feedSettings.constants';
import type { ReportCategory, TemplateType } from '@/types/feed-settings';

type Props = {
  currentTemplate: TemplateType;
  newItemName: string;
  newItemCategory: ReportCategory | null;
  onChangeName: (value: string) => void;
  onChangeCategory: (cat: ReportCategory) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function AddItemForm({
  currentTemplate,
  newItemName,
  newItemCategory,
  onChangeName,
  onChangeCategory,
  onSubmit,
  onCancel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const templateLabel = currentTemplate
    ? currentTemplate === 'text'
      ? '(문장형)'
      : currentTemplate === 'precise'
      ? '(5점 단위)'
      : '(10점 단위)'
    : '(방식 미선택)';

  // AI 리포트 영역 선택 완료 여부
  const isCategorySelected = newItemCategory !== null;

  // 카테고리 선택되면 입력창에 포커스
  useEffect(() => {
    if (isCategorySelected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCategorySelected]);

  return (
    <Card className={`${feedStyles.card.modal} border-[#6366F1]`}>
      <CardHeader>
        <CardTitle className={feedStyles.layout.modalTitleRow}>
          새 평가항목 추가
          <span className={feedStyles.text.modeLabel}>{templateLabel}</span>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* AI category - 선택 전이면 테두리 강조 */}
        <div 
          className={`
            mt-4 rounded-lg p-4 transition-all
            ${isCategorySelected 
              ? 'border border-[#E8E5E0] bg-[#FAFAF9]' 
              : 'border-2 border-[#6366F1] bg-[#EEF2FF]/30'
            }
          `}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[#37352F]">
              AI 리포트 영역 <span className="text-red-500">*</span>
            </p>
            {!isCategorySelected && (
              <span className="text-xs px-3 py-1 rounded-full bg-[#6366F1] text-white font-medium animate-pulse">
                먼저 선택해주세요
              </span>
            )}
          </div>

          <p className="text-xs text-[#9B9A97] mb-3">
            이 평가항목이 AI 리포트에서 어느 문단(학습 / 태도 / 출결 / 없음)에 들어갈지 한 번만
            선택해주세요.
          </p>

          <div className="flex gap-3 text-sm">
            {REPORT_CATEGORIES.map((cat) => {
              const label = REPORT_CATEGORY_LABEL[cat];
              const isActive = newItemCategory === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  className={`
                    flex-1 px-4 py-3 rounded-lg border text-center font-medium transition-all
                    ${isActive
                      ? 'bg-[#6366F1] border-[#6366F1] text-white shadow-sm'
                      : 'bg-white border-[#E8E5E0] text-[#9B9A97] hover:border-[#6366F1] hover:bg-[#EEF2FF]'
                    }
                  `}
                  onClick={() => onChangeCategory(cat)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-[#9B9A97]">
            * 처음에 한 번 제대로 맞춰두면 AI 리포트 구조가 더 안정적입니다.
          </p>

          <div className="mt-3 space-y-1 text-xs text-[#9B9A97]">
            <p>
              <span className="font-medium text-[#37352F]">학습</span> : 교재 진도, 이해도, 문제 해결 등 수업 내용 평가
            </p>
            <p>
              <span className="font-medium text-[#37352F]">태도</span> : 숙제 성실도, 참여도, 집중도 등 학습 습관
            </p>
            <p>
              <span className="font-medium text-[#37352F]">출결</span> : 등원/지각/조퇴/결석 등 출결 관련
            </p>
            <p>
              <span className="font-medium text-[#37352F]">없음</span> : AI 서술형 문단에는 포함하지 않음
            </p>
          </div>
        </div>

        {/* name - 카테고리 선택 후 테두리 강조 */}
        <div className="mt-4">
          <input
            ref={inputRef}
            placeholder="평가항목명 (예: 숙제, 태도)"
            className={`
              w-full px-4 py-3 text-lg rounded-lg transition-all outline-none
              ${isCategorySelected
                ? 'border-2 border-[#6366F1] bg-white focus:ring-2 focus:ring-[#6366F1]/20'
                : 'border border-[#E8E5E0] bg-[#F7F6F3] text-[#9B9A97]'
              }
            `}
            value={newItemName}
            onChange={(e) => onChangeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
            }}
            disabled={!isCategorySelected}
          />
          {!isCategorySelected && (
            <p className="mt-1 text-xs text-[#9B9A97]">
              ↑ AI 리포트 영역을 먼저 선택해주세요
            </p>
          )}
        </div>

        {/* actions */}
        <div className={feedStyles.layout.modalActionRow}>
          <Button
            type="button"
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white px-6"
            disabled={!newItemName.trim() || !newItemCategory || !currentTemplate}
            onClick={onSubmit}
          >
            생성
          </Button>

          <Button type="button" variant="ghost" onClick={onCancel}>
            취소
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}