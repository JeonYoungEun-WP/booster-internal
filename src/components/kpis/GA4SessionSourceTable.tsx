'use client';

import { useEffect, useState } from 'react';
import { fetchGA4Data } from '@/src/lib/ga4';
import { formatNumber } from '@/src/lib/format';

interface DimensionRow {
  name: string;
  sessions: number;
}

function calcChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function formatDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(d: Date) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function useWeeklyDates() {
  const today = new Date();

  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - today.getDay());
  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  const prevSunday = new Date(lastMonday);
  prevSunday.setDate(lastMonday.getDate() - 1);
  const prevMonday = new Date(prevSunday);
  prevMonday.setDate(prevSunday.getDate() - 6);

  return {
    lastMondayStr: formatDateStr(lastMonday),
    lastSundayStr: formatDateStr(lastSunday),
    prevMondayStr: formatDateStr(prevMonday),
    prevSundayStr: formatDateStr(prevSunday),
    lastWeekLabel: `${formatDisplayDate(lastMonday)}~${formatDisplayDate(lastSunday)}`,
    prevWeekLabel: `${formatDisplayDate(prevMonday)}~${formatDisplayDate(prevSunday)}`,
  };
}

interface SubtotalDef {
  label: string;
  match: (name: string) => boolean;
}

function RankingTable({
  title,
  columnLabel,
  lastWeekLabel,
  prevWeekLabel,
  currentData,
  previousData,
  subtotals,
  footnotes,
}: {
  title: string;
  columnLabel: string;
  lastWeekLabel: string;
  prevWeekLabel: string;
  currentData: DimensionRow[];
  previousData: DimensionRow[];
  subtotals?: SubtotalDef[];
  footnotes?: string[];
}) {
  const prevMap = new Map(previousData.map((s) => [s.name, s.sessions]));

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold mb-3">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">#</th>
              <th className="text-left py-2 pr-4 font-medium text-muted-foreground">{columnLabel}</th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground">지난 주<br /><span className="text-[10px] font-normal">({lastWeekLabel})</span></th>
              <th className="text-right py-2 px-4 font-medium text-muted-foreground">지지난 주<br /><span className="text-[10px] font-normal">({prevWeekLabel})</span></th>
              <th className="text-right py-2 pl-4 font-medium text-muted-foreground">등락률</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, i) => {
              const prevSessions = prevMap.get(row.name) ?? 0;
              const change = calcChange(row.sessions, prevSessions);
              const isUp = change !== null && change > 0;
              const isDown = change !== null && change < 0;

              return (
                <tr key={row.name} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-medium">{row.name || '(direct)'}</td>
                  <td className="py-2.5 px-4 text-right font-semibold">{formatNumber(row.sessions)}</td>
                  <td className="py-2.5 px-4 text-right text-muted-foreground">{formatNumber(prevSessions)}</td>
                  <td className={`py-2.5 pl-4 text-right font-medium ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {change !== null ? (
                      <>{isUp ? '\u25B2' : isDown ? '\u25BC' : '-'}{Math.abs(change).toFixed(1)}%</>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
            {subtotals?.map((sub) => {
              const curTotal = currentData.filter((r) => sub.match(r.name)).reduce((s, r) => s + r.sessions, 0);
              const prevTotal = previousData.filter((r) => sub.match(r.name)).reduce((s, r) => s + r.sessions, 0);
              const change = calcChange(curTotal, prevTotal);
              const isUp = change !== null && change > 0;
              const isDown = change !== null && change < 0;

              return (
                <tr key={sub.label} className="border-t-2 bg-muted/30">
                  <td className="py-2.5 pr-4" />
                  <td className="py-2.5 pr-4 font-bold text-foreground">{sub.label}</td>
                  <td className="py-2.5 px-4 text-right font-bold">{formatNumber(curTotal)}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-muted-foreground">{formatNumber(prevTotal)}</td>
                  <td className={`py-2.5 pl-4 text-right font-bold ${isUp ? 'text-red-500' : isDown ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {change !== null ? (
                      <>{isUp ? '\u25B2' : isDown ? '\u25BC' : '-'}{Math.abs(change).toFixed(1)}%</>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footnotes && footnotes.length > 0 && (
        <div className="mt-3 space-y-0.5">
          {footnotes.map((note, i) => (
            <p key={i} className="text-[11px] text-muted-foreground">* {note}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function GA4SessionSourceTable() {
  const [lastWeekSources, setLastWeekSources] = useState<DimensionRow[]>([]);
  const [prevWeekSources, setPrevWeekSources] = useState<DimensionRow[]>([]);
  const [lastWeekChannels, setLastWeekChannels] = useState<DimensionRow[]>([]);
  const [prevWeekChannels, setPrevWeekChannels] = useState<DimensionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const { lastMondayStr, lastSundayStr, prevMondayStr, prevSundayStr, lastWeekLabel, prevWeekLabel } = useWeeklyDates();

  useEffect(() => {
    Promise.all([
      fetchGA4Data('custom', lastMondayStr, lastSundayStr),
      fetchGA4Data('custom', prevMondayStr, prevSundayStr),
    ])
      .then(([lw, pw]) => {
        setLastWeekSources((lw?.sessionSources ?? []).map((s) => ({ name: s.source, sessions: s.sessions })));
        setPrevWeekSources((pw?.sessionSources ?? []).map((s) => ({ name: s.source, sessions: s.sessions })));
        setLastWeekChannels((lw?.channelGroups ?? []).map((c) => ({ name: c.channel, sessions: c.sessions })));
        setPrevWeekChannels((pw?.channelGroups ?? []).map((c) => ({ name: c.channel, sessions: c.sessions })));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [lastMondayStr, lastSundayStr, prevMondayStr, prevSundayStr]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold mb-3">기본 채널 그룹 TOP 10 (세션수)</p>
          <p className="text-sm text-muted-foreground animate-pulse">로딩 중···</p>
        </div>
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold mb-3">세션 소스 TOP 10 (세션수)</p>
          <p className="text-sm text-muted-foreground animate-pulse">로딩 중···</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold mb-3">기본 채널 그룹 TOP 10 (세션수)</p>
          <p className="text-sm text-destructive">데이터를 불러올 수 없습니다.</p>
        </div>
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold mb-3">세션 소스 TOP 10 (세션수)</p>
          <p className="text-sm text-destructive">데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <RankingTable
        title="기본 채널 그룹 TOP 10 (세션수)"
        columnLabel="채널 그룹"
        lastWeekLabel={lastWeekLabel}
        prevWeekLabel={prevWeekLabel}
        currentData={lastWeekChannels}
        previousData={prevWeekChannels}
        subtotals={[
          { label: 'Organic 소계', match: (n) => ['Organic Search', 'Direct', 'Organic Social'].includes(n) },
          { label: 'Paid 소계', match: (n) => ['Paid Social', 'Paid Other', 'Paid Search'].includes(n) },
        ]}
        footnotes={[
          'Organic 소계: Organic Search + Direct + Organic Social',
          'Paid 소계: Paid Social + Paid Other + Paid Search',
        ]}
      />
      <RankingTable
        title="세션 소스 TOP 10 (세션수)"
        columnLabel="세션 소스"
        lastWeekLabel={lastWeekLabel}
        prevWeekLabel={prevWeekLabel}
        currentData={lastWeekSources}
        previousData={prevWeekSources}
      />
    </div>
  );
}
