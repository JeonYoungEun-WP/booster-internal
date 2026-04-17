'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { AdSubNav } from '@/src/components/ad-performance/SubNav';
import { DateRangePicker } from '@/src/components/ad-performance/DateRangePicker';
import { formatNumber } from '@/src/lib/format';
import {
  CHANNEL_COLOR, CHANNEL_LABEL,
  type AdMetrics, type ChannelPerformance,
  type DailyPerformance, type CampaignPerformance,
} from '@/src/lib/ad-data';

interface DashboardData {
  period: { startDate: string; endDate: string };
  total: AdMetrics;
  byChannel: ChannelPerformance[];
  daily: DailyPerformance[];
  topCampaigns: CampaignPerformance[];
}

function offset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtKRW(n: number): string { return '₩' + Math.round(n).toLocaleString('ko-KR'); }
function fmtPct(n: number): string { return n.toFixed(2) + '%'; }
function fmtDelta(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}
function deltaIcon(d: number): string {
  if (Math.abs(d) < 0.5) return '—';
  return d > 0 ? '▲' : '▼';
}
function deltaColor(d: number, goodWhenUp: boolean): string {
  if (Math.abs(d) < 0.5) return 'text-muted-foreground';
  const isUp = d > 0;
  return (isUp && goodWhenUp) || (!isUp && !goodWhenUp) ? 'text-emerald-600' : 'text-rose-600';
}
function pctDelta(curr: number, prev: number): number {
  if (!prev) return curr ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}
function getPrevPeriod(start: string, end: string): { startDate: string; endDate: string } {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const prevEnd = new Date(s);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    startDate: prevStart.toISOString().slice(0, 10),
    endDate: prevEnd.toISOString().slice(0, 10),
  };
}

function KpiBox({
  label, value, delta, goodWhenUp = true, accent,
}: {
  label: string; value: string; delta?: number; goodWhenUp?: boolean; accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 break-inside-avoid">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <p className={`text-xl md:text-2xl font-bold ${accent || ''}`}>{value}</p>
      {delta !== undefined && (
        <p className={`text-xs mt-1 ${deltaColor(delta, goodWhenUp)}`}>
          {deltaIcon(delta)} {fmtDelta(delta)} <span className="text-muted-foreground">전기간</span>
        </p>
      )}
    </div>
  );
}

export default function AdPerformanceReportPage() {
  const [startDate, setStartDate] = useState(offset(29));
  const [endDate, setEndDate] = useState(offset(0));
  const [compare, setCompare] = useState(true);
  const [curr, setCurr] = useState<DashboardData | null>(null);
  const [prev, setPrev] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const prevPeriod = useMemo(() => getPrevPeriod(startDate, endDate), [startDate, endDate]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const currUrl = `/api/ad-performance?view=dashboard&startDate=${startDate}&endDate=${endDate}`;
    const prevUrl = `/api/ad-performance?view=dashboard&startDate=${prevPeriod.startDate}&endDate=${prevPeriod.endDate}`;
    Promise.all([
      fetch(currUrl).then((r) => r.json()),
      compare ? fetch(prevUrl).then((r) => r.json()) : Promise.resolve(null),
    ]).then(([c, p]) => {
      if (!alive) return;
      setCurr(c);
      setPrev(p);
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [startDate, endDate, compare, prevPeriod.startDate, prevPeriod.endDate]);

  const insights = useMemo(() => {
    if (!curr) return [] as { tone: 'good' | 'bad' | 'info'; text: string }[];
    const out: { tone: 'good' | 'bad' | 'info'; text: string }[] = [];
    if (compare && prev) {
      const costDelta = pctDelta(curr.total.cost, prev.total.cost);
      const convDelta = pctDelta(curr.total.conversions, prev.total.conversions);
      const roasDelta = pctDelta(curr.total.roas, prev.total.roas);
      if (roasDelta >= 5) out.push({ tone: 'good', text: `전체 ROAS가 전기간 대비 ${fmtDelta(roasDelta)} 개선되었습니다 (${fmtPct(prev.total.roas)} → ${fmtPct(curr.total.roas)}).` });
      else if (roasDelta <= -5) out.push({ tone: 'bad', text: `전체 ROAS가 전기간 대비 ${fmtDelta(roasDelta)} 하락했습니다. CPA·소재·타겟팅 점검이 필요합니다.` });
      if (costDelta > 10 && convDelta < 0) out.push({ tone: 'bad', text: `광고비는 ${fmtDelta(costDelta)} 증가했지만 전환은 ${fmtDelta(convDelta)}로 감소 — 효율이 악화된 구간이 있습니다.` });
      if (costDelta < -10 && convDelta > 0) out.push({ tone: 'good', text: `광고비를 ${fmtDelta(costDelta)} 절감하면서도 전환은 ${fmtDelta(convDelta)} 증가 — 효율이 크게 개선되었습니다.` });
      const prevMap = new Map(prev.byChannel.map((c) => [c.channel, c] as const));
      const chDeltas = curr.byChannel.map((c) => ({
        ch: c.channel,
        roasDelta: pctDelta(c.roas, prevMap.get(c.channel)?.roas ?? 0),
        cpaDelta: pctDelta(c.cpa, prevMap.get(c.channel)?.cpa ?? 0),
      }));
      const topGainer = [...chDeltas].sort((a, b) => b.roasDelta - a.roasDelta)[0];
      const topLoser = [...chDeltas].sort((a, b) => a.roasDelta - b.roasDelta)[0];
      if (topGainer && topGainer.roasDelta >= 10) out.push({ tone: 'good', text: `${CHANNEL_LABEL[topGainer.ch]} ROAS가 ${fmtDelta(topGainer.roasDelta)} — 이번 기간 최고 성과 채널입니다. 예산 확대를 검토해보세요.` });
      if (topLoser && topLoser.roasDelta <= -10) out.push({ tone: 'bad', text: `${CHANNEL_LABEL[topLoser.ch]} ROAS가 ${fmtDelta(topLoser.roasDelta)} — 가장 큰 하락. 캠페인·소재 재점검이 필요합니다.` });
    }
    const topCamp = curr.topCampaigns[0];
    const worstCamp = [...curr.topCampaigns].sort((a, b) => a.roas - b.roas)[0];
    if (topCamp) out.push({ tone: 'info', text: `최고 성과 캠페인: "${topCamp.campaignName}" (ROAS ${fmtPct(topCamp.roas)}, 비용 ${fmtKRW(topCamp.cost)}).` });
    if (worstCamp && worstCamp.roas < 100) out.push({ tone: 'bad', text: `저성과 캠페인: "${worstCamp.campaignName}" ROAS ${fmtPct(worstCamp.roas)} — 손익분기(100%) 미달. 중단 또는 소재 교체 검토.` });
    return out;
  }, [curr, prev, compare]);

  const totalCost = curr?.total.cost ?? 0;

  const exportCSV = () => {
    if (!curr) return;
    const rows: (string | number)[][] = [];
    rows.push(['보고서', '광고성과분석 리포트']);
    rows.push(['기간', `${startDate} ~ ${endDate}`]);
    if (compare) rows.push(['비교 기간', `${prevPeriod.startDate} ~ ${prevPeriod.endDate}`]);
    rows.push([]);
    rows.push(['핵심 지표', '노출', '클릭', 'CTR', '광고비', 'CPC', '전환', 'CVR', 'CPA', 'ROAS']);
    rows.push([
      '이번 기간',
      curr.total.impressions, curr.total.clicks, curr.total.ctr.toFixed(2),
      curr.total.cost, curr.total.cpc.toFixed(0), curr.total.conversions,
      curr.total.cvr.toFixed(2), curr.total.cpa.toFixed(0), curr.total.roas.toFixed(2),
    ]);
    if (prev) rows.push([
      '전기간',
      prev.total.impressions, prev.total.clicks, prev.total.ctr.toFixed(2),
      prev.total.cost, prev.total.cpc.toFixed(0), prev.total.conversions,
      prev.total.cvr.toFixed(2), prev.total.cpa.toFixed(0), prev.total.roas.toFixed(2),
    ]);
    rows.push([]);
    rows.push(['채널별 성과', '노출', '클릭', 'CTR', '광고비', 'CPC', '전환', 'CVR', 'CPA', 'ROAS']);
    curr.byChannel.forEach((c) => rows.push([
      c.label, c.impressions, c.clicks, c.ctr.toFixed(2),
      c.cost, c.cpc.toFixed(0), c.conversions,
      c.cvr.toFixed(2), c.cpa.toFixed(0), c.roas.toFixed(2),
    ]));
    rows.push([]);
    rows.push(['상위 캠페인', '채널', '상태', '광고비', '전환', 'CPA', 'ROAS']);
    curr.topCampaigns.forEach((c) => rows.push([
      c.campaignName, CHANNEL_LABEL[c.channel], c.status,
      c.cost, c.conversions, c.cpa.toFixed(0), c.roas.toFixed(2),
    ]));
    const csv = rows.map((r) => r.map((v) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-report-${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 print:p-0">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 print:hidden">
          <h1 className="text-2xl font-bold">리포트 모드</h1>
          <p className="text-sm text-muted-foreground mt-1">전기간 비교, 자동 인사이트, PDF / CSV 내보내기</p>
        </div>

        <div className="print:hidden"><AdSubNav /></div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2 cursor-pointer">
              <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="rounded" />
              전기간 비교
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              PDF / 인쇄
            </button>
            <button onClick={exportCSV} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted">
              CSV 다운로드
            </button>
          </div>
        </div>

        {/* 리포트 표지 */}
        <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6 mb-6 break-inside-avoid">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ad Performance Report</p>
          <h2 className="text-3xl font-bold mb-2">광고성과분석 리포트</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-muted-foreground">기간:</span> <span className="font-medium">{startDate} ~ {endDate}</span></span>
            {compare && (
              <span className="text-muted-foreground">비교: {prevPeriod.startDate} ~ {prevPeriod.endDate}</span>
            )}
            <span className="text-muted-foreground">생성일: {new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>

        {loading || !curr ? (
          <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
        ) : (
          <>
            {/* 핵심 지표 요약 */}
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">1. 핵심 지표 요약</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiBox label="노출수" value={formatNumber(curr.total.impressions)}
                  delta={prev ? pctDelta(curr.total.impressions, prev.total.impressions) : undefined} />
                <KpiBox label="클릭수" value={formatNumber(curr.total.clicks)}
                  delta={prev ? pctDelta(curr.total.clicks, prev.total.clicks) : undefined} />
                <KpiBox label="광고비" value={fmtKRW(curr.total.cost)}
                  delta={prev ? pctDelta(curr.total.cost, prev.total.cost) : undefined} goodWhenUp={false} />
                <KpiBox label="전환수" value={formatNumber(curr.total.conversions)}
                  delta={prev ? pctDelta(curr.total.conversions, prev.total.conversions) : undefined} />
                <KpiBox label="CPA" value={fmtKRW(curr.total.cpa)} accent="text-orange-600"
                  delta={prev ? pctDelta(curr.total.cpa, prev.total.cpa) : undefined} goodWhenUp={false} />
                <KpiBox label="ROAS" value={fmtPct(curr.total.roas)}
                  accent={curr.total.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}
                  delta={prev ? pctDelta(curr.total.roas, prev.total.roas) : undefined} />
              </div>
            </section>

            {/* 인사이트 */}
            {insights.length > 0 && (
              <section className="mb-6 break-inside-avoid">
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">2. 자동 인사이트</h3>
                <div className="rounded-xl border border-border bg-card p-4 space-y-2">
                  {insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        ins.tone === 'good' ? 'bg-emerald-50 text-emerald-700' :
                        ins.tone === 'bad' ? 'bg-rose-50 text-rose-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {ins.tone === 'good' ? '✓' : ins.tone === 'bad' ? '!' : 'i'}
                      </span>
                      <span>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 채널 믹스 */}
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">3. 채널별 광고비 구성</h3>
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                {curr.byChannel.map((c) => {
                  const pct = totalCost ? (c.cost / totalCost) * 100 : 0;
                  const prevCh = prev?.byChannel.find((x) => x.channel === c.channel);
                  const roasD = prevCh ? pctDelta(c.roas, prevCh.roas) : undefined;
                  return (
                    <div key={c.channel} className="flex items-center gap-3 text-sm">
                      <div className="w-28 shrink-0 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                        <span className="font-medium truncate">{c.label}</span>
                      </div>
                      <div className="flex-1 h-6 rounded bg-muted overflow-hidden relative">
                        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: CHANNEL_COLOR[c.channel], opacity: 0.85 }} />
                        <span className="absolute left-2 top-0 h-full flex items-center text-xs font-medium text-foreground/80">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-24 text-right tabular-nums">{fmtKRW(c.cost)}</div>
                      <div className={`w-28 text-right text-xs ${roasD !== undefined ? deltaColor(roasD, true) : 'text-muted-foreground'}`}>
                        ROAS {fmtPct(c.roas)}
                        {roasD !== undefined && <> <span className="ml-1">{deltaIcon(roasD)} {fmtDelta(roasD)}</span></>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 트렌드 — 4-패널 */}
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">4. 기간 내 트렌드</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TrendCard title="광고비" data={curr.daily} dataKey="cost" color="#3b82f6" formatter={(v) => fmtKRW(Number(v))} yFmt={(v) => `${(v / 10000).toFixed(0)}만`} />
                <TrendCard title="클릭수" data={curr.daily} dataKey="clicks" color="#22c55e" formatter={(v) => formatNumber(Number(v))} />
                <TrendCard title="전환수" data={curr.daily} dataKey="conversions" color="#f97316" formatter={(v) => formatNumber(Number(v))} />
                <TrendCard title="노출수" data={curr.daily} dataKey="impressions" color="#a855f7" formatter={(v) => formatNumber(Number(v))} yFmt={(v) => `${(v / 1000).toFixed(0)}K`} />
              </div>
            </section>

            {/* 채널별 성과 테이블 (델타 포함) */}
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">5. 채널별 성과 상세</h3>
              <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3">채널</th>
                      <th className="py-2 px-3 text-right">광고비</th>
                      <th className="py-2 px-3 text-right">전환</th>
                      <th className="py-2 px-3 text-right">CTR</th>
                      <th className="py-2 px-3 text-right">CPC</th>
                      <th className="py-2 px-3 text-right">CPA</th>
                      <th className="py-2 px-3 text-right">ROAS</th>
                      {prev && <th className="py-2 px-3 text-right">ROAS Δ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {curr.byChannel.map((c) => {
                      const p = prev?.byChannel.find((x) => x.channel === c.channel);
                      const roasD = p ? pctDelta(c.roas, p.roas) : undefined;
                      return (
                        <tr key={c.channel} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                              <span className="font-medium">{c.label}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">{fmtKRW(c.cost)}</td>
                          <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                          <td className="py-2 px-3 text-right">{fmtPct(c.ctr)}</td>
                          <td className="py-2 px-3 text-right">{fmtKRW(c.cpc)}</td>
                          <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                          <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
                          {prev && (
                            <td className={`py-2 px-3 text-right text-xs ${roasD !== undefined ? deltaColor(roasD, true) : ''}`}>
                              {roasD !== undefined ? <>{deltaIcon(roasD)} {fmtDelta(roasD)}</> : '—'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 상위 캠페인 TOP 5 with bar */}
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">6. 상위 캠페인 TOP 5</h3>
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                {curr.topCampaigns.slice(0, 5).map((c, i) => {
                  const maxCost = curr.topCampaigns[0]?.cost ?? 1;
                  const pct = (c.cost / maxCost) * 100;
                  return (
                    <div key={i} className="text-sm">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                          <span className="font-medium truncate">{c.campaignName}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                            {CHANNEL_LABEL[c.channel]}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs shrink-0">
                          <span>전환 <span className="font-semibold text-foreground">{formatNumber(c.conversions)}</span></span>
                          <span>CPA <span className="font-semibold text-foreground">{fmtKRW(c.cpa)}</span></span>
                          <span className={c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}>ROAS {fmtPct(c.roas)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                          <div className="h-full" style={{ width: `${pct}%`, backgroundColor: CHANNEL_COLOR[c.channel] }} />
                        </div>
                        <span className="text-xs tabular-nums w-20 text-right">{fmtKRW(c.cost)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 캠페인 전체 표 */}
            <section className="break-inside-avoid">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">7. 캠페인 전체 내역</h3>
              <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 px-3">캠페인</th>
                      <th className="py-2 px-3">채널</th>
                      <th className="py-2 px-3">상태</th>
                      <th className="py-2 px-3 text-right">광고비</th>
                      <th className="py-2 px-3 text-right">클릭</th>
                      <th className="py-2 px-3 text-right">전환</th>
                      <th className="py-2 px-3 text-right">CPA</th>
                      <th className="py-2 px-3 text-right">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {curr.topCampaigns.map((c, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{c.campaignName}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHANNEL_COLOR[c.channel] }} />
                            {CHANNEL_LABEL[c.channel]}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-xs rounded-full px-2 py-0.5 ${c.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                            {c.status === 'ACTIVE' ? '진행 중' : '일시중지'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cost)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.clicks)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                        <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                        <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-xs text-muted-foreground text-center mt-8 print:mt-4">
              ⓒ Wepick Booster — 광고성과분석 리포트
            </p>
          </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function TrendCard({
  title, data, dataKey, color, formatter, yFmt,
}: {
  title: string;
  data: DailyPerformance[];
  dataKey: keyof DailyPerformance;
  color: string;
  formatter: (v: number | string) => string;
  yFmt?: (v: number) => string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${String(dataKey)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => String(v).slice(5)} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={yFmt ?? ((v) => String(v))} width={40} />
          <Tooltip formatter={(v) => formatter(v as number)} labelFormatter={(l) => `${l}`} />
          <Area type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={2} fill={`url(#grad-${String(dataKey)})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
