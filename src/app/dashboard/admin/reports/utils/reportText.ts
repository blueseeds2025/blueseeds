import type { WeeklyReportData, MessageTone, CategoryStat, ReportStyleTemplate } from '@/types/report';
import { 
  scoreToBlockGauge, 
  scoreToSliderGauge, 
  scoreToHeartGauge,
  getScoreEmoji,
  getCategoryEmoji,
  countToDots, 
  REPORT_INTRO_TEMPLATES,
  PRAISE_TEMPLATES
} from '@/types/report';

// ============================================================================
// 날짜 포맷 헬퍼
// ============================================================================

function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}월${date.getDate()}일`;
}

// ============================================================================
// 다음 목표 생성 헬퍼
// ============================================================================

function generateNextGoal(weaknesses: string[], tone: MessageTone): string {
  if (weaknesses.length === 0) {
    // 보완점 없으면 랜덤 칭찬
    const praiseList = PRAISE_TEMPLATES[tone];
    const randomIndex = Math.floor(Math.random() * praiseList.length);
    return praiseList[randomIndex];
  }
  
  // 보완점 있으면 집중 학습 목표
  const goalPrefix = tone === 'formal' ? '집중 학습 필요: ' 
                   : tone === 'friendly' ? '다음엔 이것만 신경 쓰면 돼요: '
                   : '';
  return goalPrefix + weaknesses.join(', ') + (tone === 'formal' ? '' : ' 집중 학습');
}

// ============================================================================
// 카테고리 통계를 텍스트로 변환 (템플릿별)
// ============================================================================

function formatCategoryStat(stat: CategoryStat, template: ReportStyleTemplate): string {
  if (stat.isScored) {
    switch (template) {
      case 'simple': {
        // 🟢 학습 태도  93
        const emoji = getScoreEmoji(stat.avgScore);
        return `${emoji} ${stat.statsCategory}  ${stat.avgScore}`;
      }
      case 'block': {
        // 🟢 학습 태도 93 ▰▰▰▰▰▰▰▰▰▱
        const emoji = getScoreEmoji(stat.avgScore);
        const gauge = scoreToBlockGauge(stat.avgScore);
        return `${emoji} ${stat.statsCategory} ${stat.avgScore} ${gauge}`;
      }
      case 'slider': {
        // 🟢 학습 태도 93 ━━━━━━━━◉─
        const emoji = getScoreEmoji(stat.avgScore);
        const gauge = scoreToSliderGauge(stat.avgScore);
        return `${emoji} ${stat.statsCategory} ${stat.avgScore} ${gauge}`;
      }
      case 'heart': {
        // 💗 학습 태도 (93) ❤️❤️❤️❤️❤️
        const emoji = getCategoryEmoji(stat.statsCategory);
        const gauge = scoreToHeartGauge(stat.avgScore);
        return `${emoji} ${stat.statsCategory} (${stat.avgScore}) ${gauge}`;
      }
    }
  } else {
    // 문장형: 카테고리명: 최다옵션 ●●●○○ (3/5회)
    const dots = countToDots(stat.topCount, stat.totalCount);
    return `${stat.statsCategory}: ${stat.topOption} ${dots} (${stat.topCount}/${stat.totalCount}회)`;
  }
}

// ============================================================================
// 주간 리포트 전체 텍스트 생성
// ============================================================================

export function generateReportText(
  report: WeeklyReportData,
  tone: MessageTone,
  template: ReportStyleTemplate = 'simple'
): string {
  const { student, period, categoryStats, overallAvgScore, analysis } = report;
  
  const startDateFormatted = formatDateKorean(period.startDate);
  const endDateFormatted = formatDateKorean(period.endDate);
  
  // 심플 템플릿은 별도 포맷
  if (template === 'simple') {
    return generateSimpleReport(report, tone, startDateFormatted, endDateFormatted);
  }
  
  // 1. 인트로
  const introTemplate = REPORT_INTRO_TEMPLATES[tone];
  const intro = introTemplate
    .replace(/{startDate}/g, startDateFormatted)
    .replace(/{endDate}/g, endDateFormatted)
    .replace(/{studentName}/g, student.name);
  
  // 2. 항목별 점수/통계
  const scoreStats = categoryStats.filter(s => s.isScored);
  const textStats = categoryStats.filter(s => !s.isScored);
  
  let statsSection = '';
  
  if (scoreStats.length > 0) {
    statsSection += '\n\n📊 항목별 성취도\n';
    statsSection += scoreStats.map(s => formatCategoryStat(s, template)).join('\n');
  }
  
  if (textStats.length > 0) {
    statsSection += '\n\n📋 학습 태도\n';
    statsSection += textStats.map(s => formatCategoryStat(s, template)).join('\n');
  }
  
  // 3. 총평
  let summarySection = '';
  if (overallAvgScore !== null) {
    const summaryEmoji = template === 'heart' ? '⭐' : '🏆';
    summarySection = `\n\n${summaryEmoji} 종합: ${overallAvgScore}점`;
  }
  
  // 4. 강점/보완/다음목표
  const strengthsText = analysis.strengths.length > 0
    ? analysis.strengths.join(', ')
    : '-';
  
  const nextGoal = generateNextGoal(analysis.weaknesses, tone);
  
  let analysisSection = `\n\n✅ 잘하는 점: ${strengthsText}`;
  
  if (analysis.weaknesses.length > 0) {
    analysisSection += `\n⚡ 노력할 점: ${analysis.weaknesses.join(', ')}`;
    analysisSection += `\n🎯 다음 목표: ${nextGoal}`;
  } else {
    analysisSection += `\n🎯 ${nextGoal}`;
  }
  
  // 5. 전체 조합
  return intro + statsSection + summarySection + analysisSection;
}

// ============================================================================
// 심플 템플릿 (점수만 깔끔하게)
// ============================================================================

function generateSimpleReport(
  report: WeeklyReportData,
  tone: MessageTone,
  startDate: string,
  endDate: string
): string {
  const { student, categoryStats, overallAvgScore, analysis } = report;
  
  const scoreStats = categoryStats.filter(s => s.isScored);
  
  let text = '';
  
  // 헤더
  text += `📊 ${startDate}~${endDate} 학습 리포트\n`;
  text += `${student.name}\n\n`;
  
  // 점수
  if (scoreStats.length > 0) {
    text += scoreStats.map(s => formatCategoryStat(s, 'simple')).join('\n');
    text += '\n';
  }
  
  // 종합
  if (overallAvgScore !== null) {
    text += `\n🏆 종합: ${overallAvgScore}점\n`;
  }
  
  // 분석
  const strengthsText = analysis.strengths.length > 0
    ? analysis.strengths.join(', ')
    : '-';
  
  const nextGoal = generateNextGoal(analysis.weaknesses, tone);
  
  text += `\n✅ 잘하는 점: ${strengthsText}\n`;
  
  if (analysis.weaknesses.length > 0) {
    text += `⚡ 노력할 점: ${analysis.weaknesses.join(', ')}\n`;
    text += `🎯 다음 목표: ${nextGoal}`;
  } else {
    text += `🎯 ${nextGoal}`;
  }
  
  return text;
}

// ============================================================================
// 간단 버전 (카톡 복사용 - 짧은 버전)
// ============================================================================

export function generateReportTextShort(
  report: WeeklyReportData,
  tone: MessageTone,
  template: ReportStyleTemplate = 'simple'
): string {
  const { student, period, categoryStats, overallAvgScore, analysis } = report;
  
  const startDateFormatted = formatDateKorean(period.startDate);
  const endDateFormatted = formatDateKorean(period.endDate);
  
  // 심플 템플릿은 전체 버전과 동일 (이미 간결함)
  if (template === 'simple') {
    return generateSimpleReport(report, tone, startDateFormatted, endDateFormatted);
  }
  
  // 점수형만 추출
  const scoreStats = categoryStats.filter(s => s.isScored);
  
  let text = `📊 ${startDateFormatted}~${endDateFormatted} ${student.name} 학습 리포트\n\n`;
  
  // 항목 점수
  if (scoreStats.length > 0) {
    text += scoreStats.map(s => formatCategoryStat(s, template)).join('\n');
  }
  
  // 총평
  if (overallAvgScore !== null) {
    const summaryEmoji = template === 'heart' ? '⭐' : '🏆';
    text += `\n\n${summaryEmoji} 종합: ${overallAvgScore}점`;
  }
  
  // 잘하는 점/노력할 점
  const nextGoal = generateNextGoal(analysis.weaknesses, tone);
  
  text += `\n\n✅ 잘하는 점: ${analysis.strengths.length > 0 ? analysis.strengths.join(', ') : '-'}`;
  
  if (analysis.weaknesses.length > 0) {
    text += `\n⚡ 노력할 점: ${analysis.weaknesses.join(', ')}`;
    text += `\n🎯 다음 목표: ${nextGoal}`;
  } else {
    text += `\n🎯 ${nextGoal}`;
  }
  
  return text;
}

// ============================================================================
// 클립보드 복사 헬퍼 (클라이언트용)
// ============================================================================

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('클립보드 복사 실패:', error);
    
    // Fallback: textarea 방식
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}