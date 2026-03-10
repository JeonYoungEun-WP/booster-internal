'use client';

import { useEffect, useState } from 'react';
import { Users, Eye } from 'lucide-react';
import { fetchGA4Data } from '@/src/lib/ga4';
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
        if (lw) setLastWeekStats({ visitors: lw.totalVisitors, pageViews: lw.totalPageViews });
        if (pw) setPrevWeekStats({ visitors: pw.totalVisitors, pageViews: pw.totalPageViews });
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
      {!loading && !error && lastWeekStats && prevWeekStats && (
        <WeeklyComment
          current={lastWeekStats}
          previous={prevWeekStats}
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

function WeeklyComment({ current, previous }: { current: PeriodStats; previous: PeriodStats }) {
  const visitorChange = calcChange(current.visitors, previous.visitors);
  const pvChange = calcChange(current.pageViews, previous.pageViews);
  const pagesPerVisitor = current.visitors > 0 ? (current.pageViews / current.visitors).toFixed(1) : '0';
  const prevPagesPerVisitor = previous.visitors > 0 ? (previous.pageViews / previous.visitors).toFixed(1) : '0';

  const visitorTrend = visitorChange !== null && visitorChange > 0 ? '증가' : visitorChange !== null && visitorChange < 0 ? '감소' : '유지';
  const pvTrend = pvChange !== null && pvChange > 0 ? '증가' : pvChange !== null && pvChange < 0 ? '감소' : '유지';

  const comments = [
    `\u2022 주간 방문자 ${formatNumber(current.visitors)}명으로 전주 대비 ${visitorTrend}했습니다.`,
    `\u2022 페이지뷰 ${formatNumber(current.pageViews)}회로 전주 대비 ${pvTrend} 추세입니다.`,
    `\u2022 방문자당 평균 ${pagesPerVisitor}페이지를 조회했습니다. (전주 ${prevPagesPerVisitor}페이지)`,
    `\u2022 일 평균 방문자는 ${formatNumber(Math.round(current.visitors / 7))}명입니다.`,
    visitorChange !== null && visitorChange > 5
      ? '\u2022 트래픽이 눈에 띄게 상승 중이므로 전환율 최적화에 집중할 시점입니다.'
      : visitorChange !== null && visitorChange < -5
        ? '\u2022 트래픽이 하락세이므로 유입 채널별 성과를 점검해 보세요.'
        : '\u2022 트래픽이 안정적으로 유지되고 있어 콘텐츠 품질 개선에 집중하세요.',
  ];

  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">주간 트래픽 코멘트</p>
      <div className="space-y-1">
        {comments.map((comment, i) => (
          <p key={i} className="text-xs text-muted-foreground leading-relaxed">{comment}</p>
        ))}
      </div>
    </div>
  );
}
