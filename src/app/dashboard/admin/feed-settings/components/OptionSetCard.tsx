'use client';

import type { CSSProperties } from 'react';
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Info,
} from 'lucide-react';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { feedStyles, cn } from '@/styles/feedSettings.styles';
import type { OptionSet, Option, ReportCategory } from '@/types/feed-settings';
import { REPORT_CATEGORIES, REPORT_CATEGORY_LABEL } from '../feedSettings.constants';

import SortableOptionRow from './SortableOptionRow';

type Props = {
  set: OptionSet;
  expanded: boolean;

  isEditMode: boolean;

  categoryValue: ReportCategory;
  optionList: Option[];

  // card handlers
  onToggleExpand: () => void;
  onToggleSetActive: () => void;

  // name edit (묶음)
  nameEdit: {
    editing: boolean;
    value: string;
    onStart: () => void;
    onChange: (v: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
  };

  // menu actions
  onDuplicate: () => void;
  onDeleteSet: () => void;

  // category change
  onChangeCategory: (cat: ReportCategory) => void;

  // confirm dialog (모달용)
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'default' | 'danger';
  }) => Promise<boolean>;

  // dnd
  sensors: any; // dnd-kit sensors 타입 단순화
  onDragEnd: (event: DragEndEvent) => void;

  // option row actions
  onDeleteOption: (optionId: string) => void;
  onUpdateOption: (optionId: string, newLabel: string, newScore: number | null) => void;

  // add option (묶음)
  optionDraft: {
    value: string;
    onChange: (v: string) => void;
    onAdd: () => void;
  };
};

export default function OptionSetCard({
  set,
  expanded,
  isEditMode,
  categoryValue,
  optionList,

  onToggleExpand,
  onToggleSetActive,

  nameEdit,
  onDuplicate,
  onDeleteSet,

  onChangeCategory,

  confirm,

  sensors,
  onDragEnd,

  onDeleteOption,
  onUpdateOption,

  optionDraft,
}: Props) {
  const style: CSSProperties | undefined = undefined;

  return (
    <Card style={style} className={`${feedStyles.card.base} ${!set.is_active ? feedStyles.card.inactive : ''}`}>
      <CardHeader className={feedStyles.layout.cardHeader} onClick={onToggleExpand}>
        <div className={feedStyles.layout.cardHeaderInner}>
          <div className={feedStyles.layout.cardHeaderLeft}>
            {expanded ? (
              <ChevronDown className={feedStyles.icon.chevron} />
            ) : (
              <ChevronRight className={feedStyles.icon.chevron} />
            )}

            <Checkbox
              checked={set.is_active}
              onCheckedChange={() => onToggleSetActive()}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 border-[#E8E5E0] data-[state=checked]:bg-[#6366F1] data-[state=checked]:border-[#6366F1]"
            />

            {nameEdit.editing ? (
              <input
                value={nameEdit.value}
                onChange={(e) => nameEdit.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur(); // blur 트리거해서 저장
                  }
                  if (e.key === 'Escape') {
                    nameEdit.onCancel();
                  }
                }}
                onBlur={() => {
                  const trimmed = nameEdit.value.trim();
                  if (!trimmed) {
                    nameEdit.onCancel();
                  } else {
                    nameEdit.onConfirm();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className={feedStyles.input.setName}
                placeholder="평가항목명"
              />
            ) : (
              <>
                <span className={!set.is_active ? feedStyles.text.sectionTitleInactive : feedStyles.text.sectionTitle}>
                  {set.name}
                </span>
                {/* ✅ 연필 아이콘 밖으로 - 이름 옆에 바로 표시 */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    nameEdit.onStart();
                  }}
                >
                  <Pencil className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                </Button>
              </>
            )}

            <span className={feedStyles.badge.gray}>
              {set.is_scored ? (set.score_step ? `${set.score_step}점 단위` : '점수형') : '문장형'}
            </span>
          </div>

          <div className={feedStyles.layout.cardHeaderRight}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={feedStyles.button.ghost}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="더보기"
                >
                  <MoreVertical className={feedStyles.icon.small} />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-40">
                <DropdownMenuItem
                  onSelect={() => {
                    nameEdit.onStart();
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  이름 변경
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={async () => {
                    const ok = await confirm({
                      title: '평가항목 복제',
                      description: `이 평가항목을 복제할까요?\n\n복제본은 "${set.name} (복제)" 형태로 만들어집니다.`,
                      confirmLabel: '복제',
                    });
                    if (!ok) return;
                    onDuplicate();
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  복제
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem className="text-red-600 focus:text-red-600" onSelect={onDeleteSet}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className={feedStyles.card.expandedContent}>
          {/* AI report category (set-level) */}
          <div
            className={cn(
              feedStyles.layout.categoryRow,
              isEditMode ? feedStyles.layout.categoryRowBoxOn : feedStyles.layout.categoryRowBoxOff
            )}
          >
            {!isEditMode && (
              <div className={feedStyles.text.categoryHint}>
                <Info className={cn(feedStyles.icon.info, 'w-3 h-3')} />
                AI 매핑 편집 모드를 켜면 수정할 수 있습니다
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="font-semibold">AI 리포트 영역:</span>

              {REPORT_CATEGORIES.map((cat) => {
                const isActive = categoryValue === cat;
                const disabled = !isEditMode;

                return (
                  <button
                    key={cat}
                    type="button"
                    title={disabled ? '편집하려면 상단에서 AI 매핑 편집 모드를 켜세요' : ''}
                    className={
                      feedStyles.categoryButton.base +
                      ' ' +
                      (isActive ? feedStyles.categoryButton.active : feedStyles.categoryButton.inactive) +
                      ' ' +
                      (disabled ? feedStyles.categoryButton.disabled : feedStyles.categoryButton.interactiveHover)
                    }
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (disabled) return;

                      const ok = await confirm({
                        title: 'AI 리포트 영역 변경',
                        description: '⚠️ 이 설정을 변경하면 이 세트의 모든 옵션 AI 리포트 영역도 동일하게 일괄 변경됩니다.\n\n정말 변경하시겠습니까?',
                        confirmLabel: '변경',
                      });
                      if (!ok) return;

                      onChangeCategory(cat);
                    }}
                  >
                    {REPORT_CATEGORY_LABEL[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options list (DnD) */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={optionList.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <div className={feedStyles.layout.optionList}>
                {optionList.map((option) => (
                  <SortableOptionRow
                    key={option.id}
                    option={option}
                    isScored={set.is_scored}
                    onDelete={(optionId) => onDeleteOption(optionId)}
                    onUpdate={(optionId, newLabel, newScore) => onUpdateOption(optionId, newLabel, newScore)}
                  />
                ))}

                {optionList.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    아래에서 옵션을 추가해주세요 💡
                  </p>
                )}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add option */}
          <div className={feedStyles.layout.optionAddRow}>
            <input
              className={feedStyles.input.base}
              placeholder={set.is_scored ? '옵션명 + 점수 (예: 적극적 100)' : '옵션명 (예: 등원)'}
              value={optionDraft.value}
              onChange={(e) => optionDraft.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') optionDraft.onAdd();
              }}
            />

            <Button 
              onClick={optionDraft.onAdd}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white"
            >
              추가
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}