'use client';

import { useState } from 'react';
import { ArrowRight, Check, X, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { TransferRequest } from '../actions/transfer-actions';
import { approveTransferRequest, rejectTransferRequest } from '../actions/transfer-actions';

const DAY_NAMES: Record<number, string> = {
  0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토'
};

interface Props {
  initialRequests: TransferRequest[];
}

export default function PendingTransfersCard({ initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  async function handleApprove(id: string) {
    setProcessingId(id);
    const result = await approveTransferRequest(id);
    
    if (result.ok) {
      toast.success('이동이 승인되었습니다');
      setRequests(prev => prev.filter(r => r.id !== id));
    } else {
      toast.error(result.message || '승인에 실패했습니다');
    }
    setProcessingId(null);
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    const result = await rejectTransferRequest(id, rejectNote || undefined);
    
    if (result.ok) {
      toast.success('이동이 거절되었습니다');
      setRequests(prev => prev.filter(r => r.id !== id));
      setRejectingId(null);
      setRejectNote('');
    } else {
      toast.error(result.message || '거절에 실패했습니다');
    }
    setProcessingId(null);
  }

  if (requests.length === 0) {
    return null; // 요청 없으면 카드 숨김
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
            <Clock className="w-4 h-4 text-[#D97706]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#111827]">이동 승인 대기</h3>
            <p className="text-xs text-[#6B7280]">{requests.length}건</p>
          </div>
        </div>
      </div>

      {/* 요청 목록 */}
      <div className="divide-y divide-[#F3F4F6]">
        {requests.map(request => (
          <div key={request.id} className="p-4">
            {/* 학생 정보 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-medium text-[#111827]">
                  {request.studentName}
                  <span className="ml-1 text-xs text-[#9CA3AF]">
                    ({request.studentCode})
                  </span>
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  요청: {request.requestedByName} · {formatTimeAgo(request.createdAt)}
                </p>
              </div>
              {request.scope === 'same_group' && (
                <span className="px-2 py-0.5 text-xs bg-[#EEF2FF] text-[#6366F1] rounded-full">
                  그룹 전체
                </span>
              )}
            </div>

            {/* 이동 정보 */}
            <div className="flex items-center gap-2 text-sm mb-3">
              <div 
                className="px-2 py-1 rounded text-white text-xs font-medium"
                style={{ backgroundColor: request.fromClassColor || '#6B7280' }}
              >
                {request.fromClassName}
              </div>
              <div className="flex items-center text-[#9CA3AF]">
                <span className="text-xs mr-1">
                  {DAY_NAMES[request.fromDayOfWeek]} {request.fromStartTime}
                </span>
                <ArrowRight className="w-4 h-4" />
              </div>
              <div 
                className="px-2 py-1 rounded text-white text-xs font-medium"
                style={{ backgroundColor: request.toClassColor || '#6B7280' }}
              >
                {request.toClassName}
              </div>
              <span className="text-xs text-[#9CA3AF]">
                {DAY_NAMES[request.toDayOfWeek]} {request.toStartTime}
              </span>
            </div>

            {/* 교사 정보 */}
            <p className="text-xs text-[#6B7280] mb-3">
              {request.fromTeacherName} → {request.toTeacherName}
            </p>

            {/* 거절 사유 입력 (거절 모드일 때) */}
            {rejectingId === request.id ? (
              <div className="space-y-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="거절 사유 (선택)"
                  className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(request.id)}
                    disabled={processingId === request.id}
                    className="flex-1 px-3 py-1.5 text-sm bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626] disabled:opacity-50"
                  >
                    {processingId === request.id ? '처리 중...' : '거절 확인'}
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote('');
                    }}
                    className="px-3 py-1.5 text-sm text-[#6B7280] hover:text-[#374151]"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              /* 승인/거절 버튼 */
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectingId(request.id)}
                  disabled={processingId === request.id}
                  className="flex-1 px-3 py-1.5 text-sm border border-[#E5E7EB] text-[#6B7280] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50"
                >
                  거절
                </button>
                <button
                  onClick={() => handleApprove(request.id)}
                  disabled={processingId === request.id}
                  className="flex-1 px-3 py-1.5 text-sm bg-[#6366F1] text-white rounded-lg hover:bg-[#4F46E5] disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {processingId === request.id ? (
                    '처리 중...'
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      승인
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 시간 포맷 헬퍼
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
