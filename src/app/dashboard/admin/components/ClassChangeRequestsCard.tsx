'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Check, Clock } from 'lucide-react';
import { getClassChangeRequests, completeClassChangeRequest } from '../actions/class-change.actions';
import { toast } from 'sonner';

interface Request {
  id: string;
  studentName: string;
  studentId: string;
  currentClass: string;
  message: string;
  requestedBy: string;
  createdAt: string;
}

export default function ClassChangeRequestsCard() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const result = await getClassChangeRequests();
    if (result.success && result.data) {
      setRequests(result.data);
    }
    setLoading(false);
  }

  async function handleComplete(requestId: string) {
    setProcessingId(requestId);
    
    const result = await completeClassChangeRequest(requestId);
    
    if (result.success) {
      toast.success('처리 완료');
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } else {
      toast.error(result.error || '처리에 실패했습니다');
    }
    
    setProcessingId(null);
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    return '방금 전';
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#F3F4F6] rounded w-1/3" />
          <div className="h-20 bg-[#F3F4F6] rounded" />
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[#6366F1]" />
        <h2 className="text-lg font-semibold text-[#111827]">
          시간 변경 요청
        </h2>
        <span className="ml-auto px-2 py-0.5 bg-[#FEE2E2] text-[#DC2626] text-xs font-medium rounded-full">
          {requests.length}
        </span>
      </div>
      
      <div className="divide-y divide-[#E5E7EB]">
        {requests.map(request => (
          <div key={request.id} className="p-4 hover:bg-[#F9FAFB]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-[#111827]">
                    {request.studentName}
                  </span>
                  <span className="text-xs text-[#6B7280]">
                    ({request.currentClass})
                  </span>
                </div>
                
                <p className="text-sm text-[#374151] mb-2">
                  {request.message}
                </p>
                
                <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                  <span>{request.requestedBy} 선생님</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(request.createdAt)}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => handleComplete(request.id)}
                disabled={processingId === request.id}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#10B981] text-white text-sm rounded-lg hover:bg-[#059669] disabled:opacity-50 transition-colors"
              >
                {processingId === request.id ? (
                  '처리중...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    완료
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
