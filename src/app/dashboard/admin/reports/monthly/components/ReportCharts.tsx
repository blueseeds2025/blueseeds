'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { 
  AttendanceSummary, 
  ScoreSummary, 
  ProgressItem,
  ExamScoreDetail,
} from '@/types/monthly-report.types';

// ============================================================================
// 출석 도넛 차트
// ============================================================================

interface AttendanceChartProps {
  data: AttendanceSummary | Record<string, unknown>;
}

const ATTENDANCE_COLORS = {
  attended: '#10B981', // green
  late: '#F59E0B',     // amber
  absent: '#EF4444',   // red
};

export function AttendanceChart({ data }: AttendanceChartProps) {
  const summary = data as AttendanceSummary;
  
  if (!summary || typeof summary.attended !== 'number') {
    return (
      <div className="h-[200px] flex items-center justify-center text-stone-400 text-sm">
        출석 데이터가 없습니다
      </div>
    );
  }
  
  const chartData = [
    { name: '출석', value: summary.attended, color: ATTENDANCE_COLORS.attended },
    { name: '지각', value: summary.late || 0, color: ATTENDANCE_COLORS.late },
    { name: '결석', value: summary.absent || 0, color: ATTENDANCE_COLORS.absent },
  ].filter(item => item.value > 0);
  
  const total = summary.total_days || (summary.attended + (summary.late || 0) + (summary.absent || 0));
  const rate = summary.rate || Math.round((summary.attended / total) * 100);
  
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value}일`, name]}
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-stone-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* 중앙 출석률 표시 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center" style={{ marginTop: '-18px' }}>
        <p className="text-2xl font-bold text-[#7C3AED]">{rate}%</p>
        <p className="text-xs text-stone-500">출석률</p>
      </div>
    </div>
  );
}

// ============================================================================
// 점수 바 차트
// ============================================================================

interface ScoreChartProps {
  data: ScoreSummary | Record<string, unknown>;
}

const SCORE_COLORS = ['#7C3AED', '#6366F1', '#8B5CF6', '#A78BFA', '#C4B5FD'];

export function ScoreChart({ data }: ScoreChartProps) {
  const summary = data as ScoreSummary;
  
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-stone-400 text-sm">
        점수 데이터가 없습니다
      </div>
    );
  }
  
  const chartData = Object.entries(summary).map(([category, info], index) => ({
    name: category.length > 6 ? category.slice(0, 6) + '...' : category,
    fullName: category,
    score: info.average || 0,
    count: info.count || 0,
    trend: info.trend,
    fill: SCORE_COLORS[index % SCORE_COLORS.length],
  }));
  
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
        <YAxis 
          type="category" 
          dataKey="name" 
          width={60} 
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            `${value}점 (${props.payload.count}회)`,
            props.payload.fullName
          ]}
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// 점수 요약 카드 (차트 대신 간단한 표시)
// ============================================================================

export function ScoreSummaryCards({ data }: ScoreChartProps) {
  const summary = data as ScoreSummary;
  
  if (!summary || Object.keys(summary).length === 0) {
    return (
      <div className="text-center py-4 text-stone-400 text-sm">
        점수 데이터가 없습니다
      </div>
    );
  }
  
  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <span className="text-green-500">↑</span>;
      case 'down': return <span className="text-red-500">↓</span>;
      default: return <span className="text-stone-400">-</span>;
    }
  };
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(summary).map(([category, info], index) => (
        <div 
          key={category}
          className="p-3 bg-stone-50 rounded-lg"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-stone-500 truncate">{category}</span>
            {getTrendIcon(info.trend)}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold" style={{ color: SCORE_COLORS[index % SCORE_COLORS.length] }}>
              {info.average}
            </span>
            <span className="text-xs text-stone-400">점</span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">{info.count}회 평가</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 진도 타임라인
// ============================================================================

interface ProgressTimelineProps {
  data: ProgressItem[] | unknown[];
}

export function ProgressTimeline({ data }: ProgressTimelineProps) {
  const items = data as ProgressItem[];
  
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400 text-sm">
        <div className="w-12 h-12 mx-auto mb-3 bg-stone-100 rounded-full flex items-center justify-center">
          📚
        </div>
        진도 데이터가 없습니다
        <p className="text-xs mt-1">피드에서 진도를 입력하면 여기에 표시됩니다</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex gap-3">
          {/* 타임라인 */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
              <span className="text-xs font-bold text-[#7C3AED]">{item.week}</span>
            </div>
            {index < items.length - 1 && (
              <div className="w-0.5 flex-1 bg-[#7C3AED]/20 mt-1" />
            )}
          </div>
          
          {/* 내용 */}
          <div className="flex-1 pb-3">
            <p className="text-xs text-stone-400 mb-0.5">{item.week}주차</p>
            <p className="text-sm text-stone-700">{item.content}</p>
            {item.note && (
              <p className="text-xs text-stone-500 mt-1">{item.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 출석 요약 바 (간단한 버전)
// ============================================================================

export function AttendanceBar({ data }: AttendanceChartProps) {
  const summary = data as AttendanceSummary;
  
  if (!summary || typeof summary.attended !== 'number') {
    return null;
  }
  
  const total = summary.total_days || (summary.attended + (summary.late || 0) + (summary.absent || 0));
  const attendedPercent = Math.round((summary.attended / total) * 100);
  const latePercent = Math.round(((summary.late || 0) / total) * 100);
  const absentPercent = Math.round(((summary.absent || 0) / total) * 100);
  
  return (
    <div>
      {/* 바 */}
      <div className="h-4 rounded-full overflow-hidden flex bg-stone-100">
        <div 
          className="bg-green-500 transition-all"
          style={{ width: `${attendedPercent}%` }}
        />
        <div 
          className="bg-amber-500 transition-all"
          style={{ width: `${latePercent}%` }}
        />
        <div 
          className="bg-red-500 transition-all"
          style={{ width: `${absentPercent}%` }}
        />
      </div>
      
      {/* 범례 */}
      <div className="flex gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-stone-600">출석 {summary.attended}일</span>
        </div>
        {(summary.late || 0) > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-stone-600">지각 {summary.late}일</span>
          </div>
        )}
        {(summary.absent || 0) > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-stone-600">결석 {summary.absent}일</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 시험 점수 요약 카드 (Basic용)
// ============================================================================

interface ExamSummaryCardProps {
  data: ExamScoreDetail | Record<string, unknown>;
}

export function ExamSummaryCard({ data }: ExamSummaryCardProps) {
  const examData = data as ExamScoreDetail;
  
  if (!examData || !examData.summary || examData.summary.count === 0) {
    return (
      <div className="text-center py-4 text-stone-400 text-sm">
        시험 데이터가 없습니다
      </div>
    );
  }
  
  const { summary } = examData;
  
  // 날짜 포맷팅 함수
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* 평균 */}
      <div className="p-4 bg-[#7C3AED]/5 rounded-xl text-center">
        <p className="text-xs text-stone-500 mb-1">평균</p>
        <p className="text-2xl font-bold text-[#7C3AED]">{summary.average}<span className="text-sm font-normal">점</span></p>
        <p className="text-xs text-stone-400 mt-1">{summary.count}회</p>
      </div>
      
      {/* 최고 */}
      <div className="p-4 bg-green-50 rounded-xl text-center">
        <p className="text-xs text-stone-500 mb-1">최고</p>
        <p className="text-2xl font-bold text-green-600">
          {summary.highest?.score ?? '-'}<span className="text-sm font-normal">점</span>
        </p>
        {summary.highest && (
          <p className="text-xs text-stone-400 mt-1">{formatDate(summary.highest.date)}</p>
        )}
      </div>
      
      {/* 최저 */}
      <div className="p-4 bg-red-50 rounded-xl text-center">
        <p className="text-xs text-stone-500 mb-1">최저</p>
        <p className="text-2xl font-bold text-red-500">
          {summary.lowest?.score ?? '-'}<span className="text-sm font-normal">점</span>
        </p>
        {summary.lowest && (
          <p className="text-xs text-stone-400 mt-1">{formatDate(summary.lowest.date)}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 시험 점수 게이지 바
// ============================================================================

interface ExamLineChartProps {
  data: ExamScoreDetail | Record<string, unknown>;
}

export function ExamLineChart({ data }: ExamLineChartProps) {
  const examData = data as ExamScoreDetail;
  
  if (!examData || !examData.records || examData.records.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400 text-sm">
        <div className="w-12 h-12 mx-auto mb-3 bg-stone-100 rounded-full flex items-center justify-center">
          📝
        </div>
        시험 데이터가 없습니다
      </div>
    );
  }
  
  // 점수별 색상
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-500', text: 'text-green-600' };
    if (score >= 80) return { bg: 'bg-[#7C3AED]', text: 'text-[#7C3AED]' };
    if (score >= 70) return { bg: 'bg-amber-500', text: 'text-amber-600' };
    return { bg: 'bg-red-500', text: 'text-red-500' };
  };
  
  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  
  // 시험 종류별 그룹핑
  const groupedExams = examData.records.reduce((acc, record) => {
    if (!acc[record.examName]) {
      acc[record.examName] = [];
    }
    acc[record.examName].push(record);
    return acc;
  }, {} as Record<string, typeof examData.records>);
  
  return (
    <div>
      {/* 전체 요약 */}
      <div className="flex justify-center items-center gap-6 mb-5 pb-4 border-b border-stone-100">
        <div className="text-center">
          <p className="text-3xl font-bold text-[#7C3AED]">{examData.summary.average}<span className="text-base font-normal text-stone-400">점</span></p>
          <p className="text-xs text-stone-400 mt-0.5">전체 평균</p>
        </div>
        <div className="w-px h-10 bg-stone-200" />
        <div className="text-center">
          <p className="text-xl font-bold text-green-600">{examData.summary.highest?.score ?? '-'}<span className="text-sm font-normal text-stone-400">점</span></p>
          <p className="text-xs text-stone-400 mt-0.5">최고</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-red-500">{examData.summary.lowest?.score ?? '-'}<span className="text-sm font-normal text-stone-400">점</span></p>
          <p className="text-xs text-stone-400 mt-0.5">최저</p>
        </div>
      </div>
      
      {/* 시험 종류별 표시 */}
      <div className="space-y-5">
        {Object.entries(groupedExams).map(([examName, records]) => {
          const count = records.length;
          
          // 4회 이상: 요약만 표시
          if (count >= 4) {
            const avg = Math.round(records.reduce((sum, r) => sum + r.score, 0) / count);
            const highest = records.reduce((max, r) => r.score > max.score ? r : max, records[0]);
            const lowest = records.reduce((min, r) => r.score < min.score ? r : min, records[0]);
            const avgColors = getScoreColor(avg);
            
            return (
              <div key={examName} className="p-4 bg-stone-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-stone-800">{examName}</span>
                  <span className="text-xs text-stone-400 bg-stone-200 px-2 py-0.5 rounded-full">{count}회</span>
                </div>
                
                {/* 평균 게이지 */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm text-stone-600">평균</span>
                    <span className={`text-sm font-bold ${avgColors.text}`}>{avg}점</span>
                  </div>
                  <div className="h-5 bg-white rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${avgColors.bg}`}
                      style={{ width: `${avg}%` }}
                    />
                  </div>
                </div>
                
                {/* 최고/최저 */}
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">최고</span>
                    <span className="font-bold text-green-600">{highest.score}점</span>
                    <span className="text-stone-400">({formatDate(highest.date)})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">최저</span>
                    <span className="font-bold text-red-500">{lowest.score}점</span>
                    <span className="text-stone-400">({formatDate(lowest.date)})</span>
                  </div>
                </div>
              </div>
            );
          }
          
          // 3회 이하: 개별 표시
          return (
            <div key={examName}>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-medium text-stone-800">{examName}</span>
                <span className="text-xs text-stone-400">({count}회)</span>
              </div>
              <div className="space-y-3">
                {records.map((record, idx) => {
                  const colors = getScoreColor(record.score);
                  return (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-stone-400">{formatDate(record.date)}</span>
                        <span className={`text-sm font-bold ${colors.text}`}>{record.score}점</span>
                      </div>
                      <div className="h-5 bg-stone-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
                          style={{ width: `${record.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 범례 */}
      <div className="flex justify-center gap-4 mt-4 pt-3 border-t border-stone-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-stone-500">90점↑</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#7C3AED]" />
          <span className="text-xs text-stone-500">80점↑</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-stone-500">70점↑</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-stone-500">70점↓</span>
        </div>
      </div>
    </div>
  );
}