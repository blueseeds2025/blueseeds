'use client';

import { useEffect, useState, useRef } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';

import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { feedStyles } from '@/styles/feedSettings.styles';
import type { Option } from '@/types/feed-settings';

type Props = {
  option: Option;
  isScored: boolean;
  onDelete: (optionId: string) => void | Promise<void>;
  onUpdate: (optionId: string, newLabel: string, newScore: number | null) => void | Promise<void>;
};

export default function SortableOptionRow({ option, isScored, onDelete, onUpdate }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: option.id });

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 편집 모드 진입시 draft 초기화
  useEffect(() => {
    if (isEditing) {
      // "라벨 점수" 형태로 합침
      if (isScored && option.score != null) {
        setDraft(`${option.label} ${option.score}`);
      } else {
        setDraft(option.label);
      }
      // 포커스
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, option.label, option.score, isScored]);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleSave = () => {
    const raw = draft.trim();
    if (!raw) {
      toast.error('옵션명을 입력하세요');
      return;
    }

    let label = raw;
    let score: number | null = null;

    if (isScored) {
      // 숫자 추출 (옵션 추가와 동일한 로직)
      const numberMatches = raw.match(/-?\d+/g);
      if (!numberMatches || numberMatches.length === 0) {
        toast.error('점수를 입력해주세요 (예: 적극적 100)');
        return;
      }

      const parsedScore = Number(numberMatches[numberMatches.length - 1]);
      if (Number.isNaN(parsedScore)) {
        toast.error('점수 형식이 올바르지 않습니다');
        return;
      }

      score = parsedScore;
      label = raw.replace(/-?\d+/g, '').trim();
      if (!label) label = '선택지';
    }

    void onUpdate(option.id, label, score);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    // 포커스 잃으면 취소 (원하면 저장으로 바꿀 수도 있음)
    setIsEditing(false);
  };

  return (
    <div ref={setNodeRef} style={style} className={feedStyles.optionRow}>
      <span className="cursor-move" {...attributes} {...listeners}>
        <GripVertical className={feedStyles.icon.drag} />
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          className={`${feedStyles.input.inline} flex-1`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={isScored ? '옵션명 점수 (예: 적극적 100)' : '옵션명'}
        />
      ) : (
        <>
          <span className="flex-1 font-medium">{option.label}</span>

          {isScored && (
            <span className={feedStyles.badge.blue}>
              {option.score}점
            </span>
          )}

          <Button
            size="icon"
            variant="ghost"
            className={feedStyles.button.iconEdit}
            onClick={() => setIsEditing(true)}
          >
            <Pencil className={feedStyles.icon.small} />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className={feedStyles.button.iconDelete}
            onClick={() => onDelete(option.id)}
          >
            <Trash2 className={feedStyles.icon.small} />
          </Button>
        </>
      )}
    </div>
  );
}