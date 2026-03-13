'use client';

import { useEffect, useState } from 'react';
import { Users, Eye } from 'lucide-react';
import { fetchGA4Data, type GA4Data } from '@/src/lib/ga4';
import { formatNumber } from '@/src/lib/format';

interface PeriodStats {
  visitors: number;
  pageViews: number;
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function formatDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function GA4YesterdayBanner() {
  const [yesterdayStats, setYesterdayStats] = useState<PeriodStats | null>(null);
  const [dayBeforeStats, setDayBeforeStats] = useState<PeriodStats | null>(null);
  const [lastWeekStats, setLastWeekStats] = useState<PeriodStats | null>(null);
  const [prevWeekStats, setPrevWeekStats] = useState<PeriodStats | null>(null);
  const [lastWeekFull, setLastWeekFull] = useState<GA4Data | null>(null);
  const [prevWeekFull, setPrevWeekFull] = useState<GA4Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const today = new Date();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dayBefore = new Date(today);
  dayBefore.setDate(today.getDate() - 2);

  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - today.getDay());
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  const prevSunday = new Date(lastMonday);
  prevSunday.setDate(lastMonday.getDate() - 1);
  const prevMonday = new Date(prevSunday);
  prevMonday.setDate(prevSunday.getDate() - 6);

  const yesterdayStr = formatDateStr(yesterday);
  const dayBeforeStr = formatDateStr(dayBefore);
  const lastMondayStr = formatDateStr(lastMonday);
  const lastSundayStr = formatDateStr(lastSunday);
  const prevMondayStr = formatDateStr(prevMonday);
  const prevSundayStr = formatDateStr(prevSunday);

  const yesterdayDisplay = formatDisplayDate(yesterday);
  const weekDisplay = `${formatDisplayDate(lastMonday)} ~ ${formatDisplayDate(lastSunday)}`;

  useEffect(() => {
    Promise.all([
      fetchGA4Data('custom', yesterdayStr, yesterdayStr),
      fetchGA4Data('custom', dayBeforeStr, dayBeforeStr),
      fetchGA4Data('custom', lastMondayStr, lastSundayStr),
      fetchGA4Data('custom', prevMondayStr, prevSundayStr),
    ])
      .then(([yd, db, lw, pw]) => {
        if (yd) setYesterdayStats({ visitors: yd.totalVisitors, pageViews: yd.totalPageViews });
        if (db) setDayBeforeStats({ visitors: db.totalVisitors, pageViews: db.totalPageViews });
        if (lw) {
          setLastWeekStats({ visitors: lw.totalVisitors, pageViews: lw.totalPageViews });
          setLastWeekFull(lw);
        }
        if (pw) {
          setPrevWeekStats({ visitors: pw.totalVisitors, pageViews: pw.totalPageViews });
          setPrevWeekFull(pw);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [yesterdayStr, dayBeforeStr, lastMondayStr, lastSundayStr, prevMondayStr, prevSundayStr]);

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <StatsRow
        icon={
          <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        }
        iconBg="bg-primary/10"
        title="어제"
        subtitle={yesterdayDisplay}
        stats={yesterdayStats}
        prevStats={dayBeforeStats}
        loading={loading}
        error={error}
      />
      <div className="border-t" />
      <StatsRow
        icon={
          <svg className="h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
        iconBg="bg-violet-500/10"
        title="지난 주"
        subtitle={weekDisplay}
        stats={lastWeekStats}
        prevStats={prevWeekStats}
        loading={loading}
        error={error}
      />
      {!loading && !error && lastWeekStats && prevWeekStats && lastWeekFull && prevWeekFull && (
        <WeeklyComment
          current={lastWeekStats}
          previous={prevWeekStats}
          currentFull={lastWeekFull}
          previousFull={prevWeekFull}
        />
      )}
    </div>
  );
}

function StatsRow({
  icon,
  iconBg,
  title,
  subtitle,
  stats,
  prevStats,
  loading,
  error,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  stats: PeriodStats | null;
  prevStats: PeriodStats | null;
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg ${iconBg} p-2`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">방문자</p>
            <p className="text-xl font-bold text-foreground">
              {loading ? (
                <span className="text-muted-foreground animate-pulse">···</span>
              ) : error ? (
                <span className="text-sm text-destructive">오류</span>
              ) : (
                <>{formatNumber(stats?.visitors ?? 0)}<ChangeRate current={stats?.visitors ?? 0} previous={prevStats?.visitors ?? 0} /></>
              )}
            </p>
          </div>
        </div>

        <div className="h-10 w-px bg-border" />

        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-green-500/10 p-2">
            <Eye className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">페이지뷰 (PVs)</p>
            <p className="text-xl font-bold text-foreground">
              {loading ? (
                <span className="text-muted-foreground animate-pulse">···</span>
              ) : error ? (
                <span className="text-sm text-destructive">오류</span>
              ) : (
                <>{formatNumber(stats?.pageViews ?? 0)}<ChangeRate current={stats?.pageViews ?? 0} previous={prevStats?.pageViews ?? 0} /></>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangeRate({ current, previous }: { current: number; previous: number }) {
  const change = calcChange(current, previous);
  if (change === null) return null;
  const isUp = change > 0;
  const isDown = change < 0;
  return (
    <span className={`ml-1.5 text-xs font-medium ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-muted-foreground'}`}>
      ({isUp ? '\u25B2' : isDown ? '\u25BC' : '-'}{Math.abs(change).toFixed(1)}%)
    </span>
  );
}

function WeeklyComment({
  current, previous, currentFull, previousFull,
}: {
  current: PeriodStats; previous: PeriodStats;
  currentFull: GA4Data; previousFull: GA4Data;
}) {
  const visitorChange = calcChange(current.visitors, previous.visitors);
  const pvChange = calcChange(current.pageViews, previous.pageViews);
  const pagesPerVisitor = current.visitors > 0 ? (current.pageViews / current.visitors) : 0;
  const prevPagesPerVisitor = previous.visitors > 0 ? (previous.pageViews / previous.visitors) : 0;
  const ppvChange = calcChange(pagesPerVisitor, prevPagesPerVisitor);

  const fmtPct = (v: number | null) => v !== null ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : '-';
  const arrow = (v: number | null) => v !== null && v > 0 ? '\u25B2' : v !== null && v < 0 ? '\u25BC' : '';

  // 채널 분석
  const totalSessions = currentFull.channelGroups.reduce((s, c) => s + c.sessions, 0);
  const prevTotalSessions = previousFull.channelGroups.reduce((s, c) => s + c.sessions, 0);
  const topChannel = currentFull.channelGroups[0];
  const topChannelPrev = previousFull.channelGroups.find(c => c.channel === topChannel?.channel);
  const topChannelChange = topChannel && topChannelPrev ? calcChange(topChannel.sessions, topChannelPrev.sessions) : null;

  // 소스 분석
  const topSource = currentFull.sessionSources[0];
  const topSourcePrev = previousFull.sessionSources.find(s => s.source === topSource?.source);
  const topSourceChange = topSource && topSourcePrev ? calcChange(topSource.sessions, topSourcePrev.sessions) : null;

  // Organic vs Paid 비율
  const organicSessions = currentFull.channelGroups
    .filter(c => c.channel.toLowerCase().includes('organic'))
    .reduce((s, c) => s + c.sessions, 0);
  const paidSessions = currentFull.channelGroups
    .filter(c => c.channel.toLowerCase().includes('paid'))
    .reduce((s, c) => s + c.sessions, 0);
  const organicRatio = totalSessions > 0 ? ((organicSessions / totalSessions) * 100).toFixed(1) : '0';
  const paidRatio = totalSessions > 0 ? ((paidSessions / totalSessions) * 100).toFixed(1) : '0';

  const prevOrganicSessions = previousFull.channelGroups
    .filter(c => c.channel.toLowerCase().includes('organic'))
    .reduce((s, c) => s + c.sessions, 0);
  const organicChange = calcChange(organicSessions, prevOrganicSessions);

  // 트랙 페이지 분석
  const track = currentFull.trackPageSessions;
  const prevTrack = previousFull.trackPageSessions;
  const trackTotal = track.simulator + track.ebook + track.insight;
  const prevTrackTotal = prevTrack.simulator + prevTrack.ebook + prevTrack.insight;
  const trackChange = calcChange(trackTotal, prevTrackTotal);

  // 일별 트렌드 분석 - 주말 vs 평일
  const dailyVisitors = currentFull.dailyTrend.map(d => d.visitors);
  const maxDay = currentFull.dailyTrend.reduce((max, d) => d.visitors > max.visitors ? d : max, currentFull.dailyTrend[0]);
  const minDay = currentFull.dailyTrend.reduce((min, d) => d.visitors < min.visitors ? d : min, currentFull.dailyTrend[0]);
  const avgDaily = dailyVisitors.length > 0 ? Math.round(dailyVisitors.reduce((a, b) => a + b, 0) / dailyVisitors.length) : 0;
  const volatility = avgDaily > 0 && dailyVisitors.length > 0
    ? Math.round(Math.sqrt(dailyVisitors.reduce((s, v) => s + (v - avgDaily) ** 2, 0) / dailyVisitors.length))
    : 0;

  // Direct 비율 (브랜드 인지도 지표)
  const directSessions = currentFull.channelGroups.find(c => c.channel === 'Direct')?.sessions || 0;
  const directRatio = totalSessions > 0 ? ((directSessions / totalSessions) * 100).toFixed(1) : '0';

  const comments: string[] = [];

  // 1. 핵심 요약
  comments.push(
    `\u2022 [핵심] 주간 방문자 ${formatNumber(current.visitors)}명(${arrow(visitorChange)}${fmtPct(visitorChange)}), PV ${formatNumber(current.pageViews)}회(${arrow(pvChange)}${fmtPct(pvChange)}). 일 평균 ${formatNumber(avgDaily)}명 방문.`
  );

  // 2. 인당 페이지뷰 (콘텐츠 품질 지표)
  comments.push(
    `\u2022 [콘텐츠 품질] 방문자당 ${pagesPerVisitor.toFixed(1)}페이지 조회(전주 ${prevPagesPerVisitor.toFixed(1)}p, ${fmtPct(ppvChange)}). ${ppvChange !== null && ppvChange < -5 ? '콘텐츠 소비 깊이가 감소하고 있어 랜딩 페이지 및 내부 링크 구조 점검이 필요합니다.' : ppvChange !== null && ppvChange > 5 ? '콘텐츠 소비가 깊어지고 있어 긍정적입니다.' : '안정적으로 유지 중입니다.'}`
  );

  // 3. 채널 분석
  if (topChannel) {
    comments.push(
      `\u2022 [채널] 최대 유입 채널은 "${topChannel.channel}"(${topChannel.sessions}세션, ${arrow(topChannelChange)}${fmtPct(topChannelChange)}). Organic ${organicRatio}% vs Paid ${paidRatio}% vs Direct ${directRatio}%.`
    );
  }

  // 4. Organic 성과 점검
  comments.push(
    `\u2022 [SEO] 오가닉 유입 ${formatNumber(organicSessions)}세션(${arrow(organicChange)}${fmtPct(organicChange)}). ${organicChange !== null && organicChange < -10 ? '오가닉 유입이 크게 감소했습니다. 검색 순위 변동, 키워드 커버리지, 콘텐츠 발행 빈도를 점검하세요.' : organicChange !== null && organicChange > 10 ? 'SEO 성과가 개선되고 있습니다. 상위 키워드를 확인하고 관련 콘텐츠를 확장하세요.' : '오가닉 유입은 안정적입니다. 신규 키워드 타겟팅으로 성장 기회를 모색하세요.'}`
  );

  // 5. 소스 분석
  if (topSource) {
    comments.push(
      `\u2022 [소스] 1위 유입 소스 "${topSource.source}"(${topSource.sessions}세션, ${arrow(topSourceChange)}${fmtPct(topSourceChange)}). ${topSource.source === '(direct)' ? 'Direct 비중이 높아 브랜드 인지도는 양호하나, 신규 유입 채널 다변화가 필요합니다.' : `${topSource.source} 의존도가 높으므로 채널 다변화를 검토하세요.`}`
    );
  }

  // 6. 리드마그넷 트랙 성과
  comments.push(
    `\u2022 [리드마그넷] 트랙 페이지 총 ${formatNumber(trackTotal)}세션(${arrow(trackChange)}${fmtPct(trackChange)}): e-book ${track.ebook}, 인사이트 ${track.insight}, 시뮬레이터 ${track.simulator}. ${track.simulator === 0 ? '시뮬레이터 유입이 0입니다. 시뮬레이터 CTA 노출 및 도달 경로를 점검하세요.' : ''}`
  );

  // 7. 일별 변동성
  if (maxDay && minDay) {
    const maxDate = maxDay.date ? `${maxDay.date.slice(4, 6)}/${maxDay.date.slice(6)}` : '';
    const minDate = minDay.date ? `${minDay.date.slice(4, 6)}/${minDay.date.slice(6)}` : '';
    comments.push(
      `\u2022 [일별 변동] 최고 ${maxDate}(${maxDay.visitors}명) vs 최저 ${minDate}(${minDay.visitors}명). 표준편차 ${volatility}명. ${volatility > avgDaily * 0.4 ? '일별 변동이 크므로 특정 요일/이벤트에 트래픽이 집중되는지 확인하세요.' : '일별 트래픽이 비교적 고르게 분포되어 있습니다.'}`
    );
  }

  // 8. Direct 비율 (브랜드 인지도)
  comments.push(
    `\u2022 [브랜드] Direct 유입 ${directRatio}%(${formatNumber(directSessions)}세션). ${Number(directRatio) > 40 ? 'Direct 비중이 40%를 초과하여 브랜드 인지도는 양호하나, UTM 태깅 누락으로 인한 오분류 가능성도 점검하세요.' : Number(directRatio) < 20 ? 'Direct 비중이 낮아 브랜드 인지도 강화(뉴스레터, SNS 등)가 필요합니다.' : '브랜드 인지도 수준은 적정 범위입니다.'}`
  );

  // 9. 전환 기회 점검
  const sessionChange = calcChange(totalSessions, prevTotalSessions);
  comments.push(
    `\u2022 [전환] 총 세션 ${formatNumber(totalSessions)}(${arrow(sessionChange)}${fmtPct(sessionChange)}). ${sessionChange !== null && sessionChange > 5 && (ppvChange === null || ppvChange < 0) ? '트래픽은 증가하지만 페이지 소비가 감소하고 있어, 랜딩 페이지 이탈률과 CTA 클릭률 점검이 시급합니다.' : sessionChange !== null && sessionChange < -5 ? '세션이 감소 추세이므로 광고 예산 배분 및 콘텐츠 발행 전략을 재점검하세요.' : '트래픽과 콘텐츠 소비가 균형을 이루고 있습니다. 전환율 최적화(CRO)에 집중하세요.'}`
  );

  // 10. 종합 액션 아이템
  const issues: string[] = [];
  if (visitorChange !== null && visitorChange < -5) issues.push('방문자 감소');
  if (organicChange !== null && organicChange < -10) issues.push('오가닉 유입 하락');
  if (ppvChange !== null && ppvChange < -5) issues.push('콘텐츠 소비 감소');
  if (track.simulator === 0) issues.push('시뮬레이터 유입 없음');
  if (Number(directRatio) > 40) issues.push('UTM 태깅 점검');

  comments.push(
    issues.length > 0
      ? `\u2022 [액션] 이번 주 점검 포인트: ${issues.join(', ')}. 우선순위별로 원인 파악 및 개선 조치를 진행하세요.`
      : '\u2022 [액션] 전반적으로 양호합니다. 기존 성과를 유지하면서 신규 콘텐츠와 채널 실험을 확대하세요.'
  );

  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">주간 트래픽 심층 분석</p>
      <div className="space-y-1.5">
        {comments.map((comment, i) => (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed">{comment}</p>
        ))}
      </div>
    </div>
  );
}
