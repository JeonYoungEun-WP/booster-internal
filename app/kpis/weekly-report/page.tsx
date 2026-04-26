'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { formatNumber } from '@/src/lib/format';

interface WeekData {
  label: string;
  startDate: string;
  endDate: string;
  uvs: number;
  pvs: number;
  paidUvs: number;
  organicUvs: number;
  channels?: Record<string, number>;
}

interface WeeklyGAResponse {
  weeks: WeekData[];
  currentWeek: WeekData | null;
  prevWeek: WeekData | null;
  year: number;
}

interface LeadWeekData {
  label: string;
  count: number;
  paid: number;
  organic: number;
}

function calcWoW(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ISO 8601: 해당 주의 목요일이 속한 월 기준
function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + diffToMon + 3);
  const month = thursday.getMonth() + 1;
  const firstOfMonth = new Date(thursday.getFullYear(), thursday.getMonth(), 1);
  const thuDow = firstOfMonth.getDay();
  const offset = thuDow <= 4 ? 4 - thuDow : 11 - thuDow;
  const firstThursday = new Date(firstOfMonth);
  firstThursday.setDate(firstOfMonth.getDate() + offset);
  const week = Math.floor((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000)) + 1;
  return `${month}-${week}W`;
}

function getDayName(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
}

export default function WeeklyReportPage() {
  const [gaData, setGaData] = useState<WeeklyGAResponse | null>(null);
  const [prevYearData, setPrevYearData] = useState<WeeklyGAResponse | null>(null);
  const [leadWeeks, setLeadWeeks] = useState<LeadWeekData[]>([]);
  const [prevLeadWeeks, setPrevLeadWeeks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const year = new Date().getFullYear();
  const prevYear = year - 1;

  useEffect(() => {
    let cancelled = false;
    setGa4Error(null);

    Promise.all([
      fetch(`/api/ga4report/weekly?year=${year}`).then(r => r.json()).catch(err => ({ error: String(err) })),
      fetch(`/api/ga4report/weekly?year=${prevYear}`).then(r => r.json()).catch(err => ({ error: String(err) })),
      fetch(`/api/leads?action=monthly&startDate=${year}-01-01 00:00:00&endDate=${year}-12-31 23:59:59`).then(r => r.json()).catch(err => ({ error: String(err), records: [] })),
      fetch(`/api/leads?action=monthly&startDate=${prevYear}-01-01 00:00:00&endDate=${prevYear}-12-31 23:59:59`).then(r => r.json()).catch(err => ({ error: String(err), records: [] })),
    ])
      .then(([ga, prevGa, leads, prevLeads]) => {
        if (cancelled) return;
        // GA4 실패해도 페이지는 렌더 (리드 데이터로 가능한 부분만 표시)
        if (ga.error) {
          setGa4Error(ga.error);
          setGaData(null);
        } else {
          setGaData(ga);
        }
        if (!prevGa.error) setPrevYearData(prevGa);

        // 리드를 주별로 집계 (paid/organic 분리)
        const SOURCE_FIELD = 'x_studio_selection_field_8p8_1i3up6bfn';
        interface LeadRecord { create_date: string; [key: string]: unknown }
        const records: LeadRecord[] = leads.records || [];
        const weekMap: Record<string, { total: number; paid: number; organic: number }> = {};
        records.forEach(r => {
          const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z');
          const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
          const day = kst.getDay();
          const monday = new Date(kst);
          monday.setDate(kst.getDate() - ((day + 6) % 7));
          const label = getWeekLabel(monday);
          if (!weekMap[label]) weekMap[label] = { total: 0, paid: 0, organic: 0 };
          weekMap[label].total += 1;
          const src = String(r[SOURCE_FIELD] || '').toLowerCase();
          if (src === 'paid') {
            weekMap[label].paid += 1;
          } else {
            weekMap[label].organic += 1;
          }
        });

        const leadData: LeadWeekData[] = (ga.weeks || []).map((w: WeekData) => ({
          label: w.label,
          count: weekMap[w.label]?.total || 0,
          paid: weekMap[w.label]?.paid || 0,
          organic: weekMap[w.label]?.organic || 0,
        }));
        setLeadWeeks(leadData);

        // 전년도 리드 주별 집계
        const prevRecords: LeadRecord[] = prevLeads.records || [];
        const prevWeekMap: Record<string, number> = {};
        prevRecords.forEach(r => {
          const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z');
          const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
          const day = kst.getDay();
          const monday = new Date(kst);
          monday.setDate(kst.getDate() - ((day + 6) % 7));
          const label = getWeekLabel(monday);
          prevWeekMap[label] = (prevWeekMap[label] || 0) + 1;
        });
        setPrevLeadWeeks(prevWeekMap);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [year, prevYear]);

  // 현재 주 정보
  const currentWeek = gaData?.currentWeek;
  const prevWeek = gaData?.prevWeek;

  // 현재 주의 리드 수
  const currentLeadCount = useMemo(() => {
    if (!currentWeek) return 0;
    return leadWeeks.find(l => l.label === currentWeek.label)?.count || 0;
  }, [currentWeek, leadWeeks]);

  const prevLeadCount = useMemo(() => {
    if (!prevWeek) return 0;
    return leadWeeks.find(l => l.label === prevWeek.label)?.count || 0;
  }, [prevWeek, leadWeeks]);

  // 전년도 주별 데이터 맵
  const prevYearMap = useMemo(() => {
    const map: Record<string, { uvs: number; pvs: number }> = {};
    if (prevYearData) {
      prevYearData.weeks.forEach(w => {
        map[w.label] = { uvs: w.uvs, pvs: w.pvs };
      });
    }
    return map;
  }, [prevYearData]);

  // 차트 데이터 (YoY 포함 - 올해 주 기준)
  const chartData = useMemo(() => {
    if (!gaData) return [];
    return gaData.weeks.map(w => {
      const lw = leadWeeks.find(l => l.label === w.label);
      return {
        label: w.label,
        uvs: w.uvs,
        paidUvs: w.paidUvs || 0,
        organicUvs: w.organicUvs || 0,
        prevUvs: prevYearMap[w.label]?.uvs || 0,
        pvs: w.pvs,
        paid: lw?.paid || 0,
        organic: lw?.organic || 0,
        leads: lw?.count || 0,
        prevLeads: prevLeadWeeks[w.label] || 0,
      };
    });
  }, [gaData, prevYearMap, leadWeeks, prevLeadWeeks]);

  // 리포트 제목
  const titleWeek = currentWeek
    ? `KR ${String(year).slice(2)} ${currentWeek.label.replace('W', 'W')}`
    : '';
  const titleDate = currentWeek
    ? `(${formatDisplayDate(currentWeek.startDate)}.${getDayName(currentWeek.startDate)}~${formatDisplayDate(currentWeek.endDate)}.${getDayName(currentWeek.endDate)})`
    : '';

  // 전환율
  const conversionRate = currentWeek && currentWeek.uvs > 0
    ? ((currentLeadCount / currentWeek.uvs) * 100).toFixed(2)
    : '0';
  const prevConversionRate = prevWeek && prevWeek.uvs > 0
    ? ((prevLeadCount / prevWeek.uvs) * 100).toFixed(2)
    : '0';

  // AI 분석 요청
  useEffect(() => {
    if (!currentWeek || !prevWeek || leadWeeks.length === 0) return;
    const curLead = leadWeeks.find(l => l.label === currentWeek.label);
    const prvLead = leadWeeks.find(l => l.label === prevWeek.label);
    const now = new Date();
    const endDate = new Date(currentWeek.endDate + 'T23:59:59');
    setAiLoading(true);
    fetch('/api/ga4report/weekly/ai-comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentWeek: {
          label: currentWeek.label,
          uvs: currentWeek.uvs,
          pvs: currentWeek.pvs,
          paidUvs: currentWeek.paidUvs || 0,
          organicUvs: currentWeek.organicUvs || 0,
          channels: currentWeek.channels || {},
        },
        prevWeek: {
          label: prevWeek.label,
          uvs: prevWeek.uvs,
          pvs: prevWeek.pvs,
          paidUvs: prevWeek.paidUvs || 0,
          organicUvs: prevWeek.organicUvs || 0,
          channels: prevWeek.channels || {},
        },
        currentLeads: { total: curLead?.count || 0, paid: curLead?.paid || 0, organic: curLead?.organic || 0 },
        prevLeads: { total: prvLead?.count || 0, paid: prvLead?.paid || 0, organic: prvLead?.organic || 0 },
        yoyUvs: prevYearMap[currentWeek.label]?.uvs ?? null,
        conversionRate: parseFloat(conversionRate),
        prevConversionRate: parseFloat(prevConversionRate),
        isIncomplete: now < endDate,
      }),
    })
      .then(r => r.json())
      .then(data => setAiComment(data.comment || null))
      .catch(() => setAiComment(null))
      .finally(() => setAiLoading(false));
  }, [currentWeek, prevWeek, leadWeeks, prevYearMap, conversionRate, prevConversionRate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-600">
            오류: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 타이틀 */}
        <div>
          <h1 className="text-2xl font-bold">위픽부스터 {titleWeek}</h1>
          <p className="text-sm text-muted-foreground mt-1">{titleDate}</p>
        </div>

        {ga4Error && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-700 dark:text-amber-300">
            GA4 데이터를 불러오지 못했습니다. 리드 통계만 표시됩니다. 원인: {ga4Error}
          </div>
        )}

        {/* AI 분석 */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">AI</span>
            주간 트래픽 분석
          </h2>
          {aiLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${85 - i * 8}%` }} />
              ))}
            </div>
          ) : aiComment ? (
            <ul className="space-y-2">
              {aiComment.split('\n').filter(l => l.trim()).map((line, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">•</span>
                  <span>{line.replace(/^[•\-\*]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">AI 분석을 불러올 수 없습니다.</p>
          )}
        </div>

        {/* 플랫폼 부문 지표 */}
        <div className="space-y-2">
          <h2 className="text-primary font-semibold text-sm">플랫폼 부문_지표</h2>

          {/* 주간 UVs 스택 바 차트 */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-center font-semibold mb-4">위픽부스터 주간UVs</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={Math.max(0, Math.floor(chartData.length / 15))}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value)), '']}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="prevUvs" name={`${String(prevYear).slice(2)}Y`} fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="paidUvs" name={`${String(year).slice(2)}Y Paid`} fill="#0ea5e9" stackId="uv" />
                <Bar dataKey="organicUvs" name={`${String(year).slice(2)}Y Organic`} fill="#7dd3fc" stackId="uv" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">
              * Paid: Paid Search, Paid Social, Paid Shopping, Paid Video, Display 등 유료 채널 유입
              &nbsp;|&nbsp; Organic: Direct, Organic Search, Referral, Email 등 비유료 채널 유입
            </p>
          </div>

          {/* 문의건수 바 차트 */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h3 className="text-center font-semibold mb-4">위픽부스터 문의건수</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={Math.max(0, Math.floor(chartData.length / 15))}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value)) + '건', '']}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar dataKey="prevLeads" name={`${String(prevYear).slice(2)}Y`} fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="paid" name={`${String(year).slice(2)}Y Paid`} fill="#3b82f6" stackId="current" />
                <Bar dataKey="organic" name={`${String(year).slice(2)}Y Organic`} fill="#93c5fd" stackId="current" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted-foreground mt-2">
              * Paid: Odoo 리드 유입경로가 &apos;paid&apos;인 문의
              &nbsp;|&nbsp; Organic: paid 외 전체 문의 (organic, direct, referral 등)
            </p>
          </div>
        </div>

        {/* 주간 트래픽 요약 테이블 */}
        <div className="space-y-2">
          <h2 className="font-bold text-lg">주간 트래픽</h2>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold">지표</th>
                  <th className="px-4 py-3 text-left font-semibold">(신)위픽부스터</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-medium">UVs</td>
                  <td className="px-4 py-3">
                    {currentWeek ? formatNumber(currentWeek.uvs) : '-'}
                    {currentWeek && prevWeek && (
                      <WoWBadge current={currentWeek.uvs} previous={prevWeek.uvs} />
                    )}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-medium">PVs</td>
                  <td className="px-4 py-3">
                    {currentWeek ? formatNumber(currentWeek.pvs) : '-'}
                    {currentWeek && prevWeek && (
                      <WoWBadge current={currentWeek.pvs} previous={prevWeek.pvs} />
                    )}
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-medium text-primary">리드수-KR</td>
                  <td className="px-4 py-3">
                    {formatNumber(currentLeadCount)}
                    <WoWBadge current={currentLeadCount} previous={prevLeadCount} />
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <td className="px-4 py-3 font-medium">
                    리드전환율
                    <span className="text-primary text-xs ml-1">-관리지표</span>
                  </td>
                  <td className="px-4 py-3">
                    {currentLeadCount}건/{currentWeek ? formatNumber(currentWeek.uvs) : 0}UVs = {conversionRate}%
                    {prevWeek && (
                      <WoWBadge
                        current={parseFloat(conversionRate)}
                        previous={parseFloat(prevConversionRate)}
                        suffix="%p"
                      />
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 채널별 유입 성과 */}
        {currentWeek?.channels && prevWeek?.channels && (() => {
          const curLead = leadWeeks.find(l => l.label === currentWeek.label);
          const prvLead = leadWeeks.find(l => l.label === prevWeek.label);
          return (
            <ChannelBreakdown
              currentChannels={currentWeek.channels}
              prevChannels={prevWeek.channels}
              currentLabel={currentWeek.label}
              prevLabel={prevWeek.label}
              currentPaidUvs={currentWeek.paidUvs || 0}
              currentOrganicUvs={currentWeek.organicUvs || 0}
              prevPaidUvs={prevWeek.paidUvs || 0}
              prevOrganicUvs={prevWeek.organicUvs || 0}
              currentLeads={{ paid: curLead?.paid || 0, organic: curLead?.organic || 0, total: curLead?.count || 0 }}
              prevLeads={{ paid: prvLead?.paid || 0, organic: prvLead?.organic || 0, total: prvLead?.count || 0 }}
            />
          );
        })()}
      </div>
    </div>
  );
}

function WoWBadge({
  current, previous, suffix,
}: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return null;
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const isNeg = pct < 0;
  const color = isNeg ? 'text-blue-600' : pct > 0 ? 'text-red-500' : 'text-muted-foreground';
  return (
    <span className={`ml-2 text-xs font-medium ${color}`}>
      (WoW {pct > 0 ? '+' : ''}{pct.toFixed(0)}%{suffix || ''})
    </span>
  );
}

const PAID_CHANNEL_SET = new Set([
  'Paid Search', 'Paid Social', 'Paid Shopping', 'Paid Video', 'Display', 'Paid Other',
]);

function ChannelBreakdown({
  currentChannels, prevChannels, currentLabel, prevLabel,
  currentPaidUvs, currentOrganicUvs, prevPaidUvs, prevOrganicUvs,
  currentLeads, prevLeads,
}: {
  currentChannels: Record<string, number>;
  prevChannels: Record<string, number>;
  currentLabel: string;
  prevLabel: string;
  currentPaidUvs: number;
  currentOrganicUvs: number;
  prevPaidUvs: number;
  prevOrganicUvs: number;
  currentLeads: { paid: number; organic: number; total: number };
  prevLeads: { paid: number; organic: number; total: number };
}) {
  const allChannels = new Set([...Object.keys(currentChannels), ...Object.keys(prevChannels)]);
  const rows = Array.from(allChannels)
    .map(ch => ({
      channel: ch,
      current: currentChannels[ch] || 0,
      prev: prevChannels[ch] || 0,
      isPaid: PAID_CHANNEL_SET.has(ch),
    }))
    .filter(r => r.current > 0 || r.prev > 0)
    .sort((a, b) => b.current - a.current);

  const paidCvr = currentPaidUvs > 0 ? (currentLeads.paid / currentPaidUvs * 100) : 0;
  const prevPaidCvr = prevPaidUvs > 0 ? (prevLeads.paid / prevPaidUvs * 100) : 0;
  const organicCvr = currentOrganicUvs > 0 ? (currentLeads.organic / currentOrganicUvs * 100) : 0;
  const prevOrganicCvr = prevOrganicUvs > 0 ? (prevLeads.organic / prevOrganicUvs * 100) : 0;
  const totalUvs = currentPaidUvs + currentOrganicUvs;
  const totalCvr = totalUvs > 0 ? (currentLeads.total / totalUvs * 100) : 0;
  const prevTotalUvs = prevPaidUvs + prevOrganicUvs;
  const prevTotalCvr = prevTotalUvs > 0 ? (prevLeads.total / prevTotalUvs * 100) : 0;

  const wowPct = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };
  const wowColor = (pct: number) => pct > 0 ? 'text-red-500' : pct < 0 ? 'text-blue-600' : 'text-muted-foreground';
  const fmtPct = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;

  return (
    <div className="space-y-2">
      <h2 className="font-bold text-lg">채널별 유입 성과</h2>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-3 text-left font-semibold">채널</th>
              <th className="px-3 py-3 text-right font-semibold">UV ({currentLabel})</th>
              <th className="px-3 py-3 text-right font-semibold">UV ({prevLabel})</th>
              <th className="px-3 py-3 text-right font-semibold">WoW</th>
              <th className="px-3 py-3 text-right font-semibold">리드</th>
              <th className="px-3 py-3 text-right font-semibold">전환율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const pct = wowPct(r.current, r.prev);
              return (
                <tr key={r.channel} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5 font-medium">
                    {r.channel}
                    {r.isPaid && <span className="ml-1 text-[10px] text-primary/60">P</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatNumber(r.current)}</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(r.prev)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${wowColor(pct)}`}>
                    {fmtPct(pct)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">-</td>
                  <td className="px-3 py-2.5 text-right text-muted-foreground">-</td>
                </tr>
              );
            })}
            {/* Paid 소계 */}
            <tr className="border-t-2 border-border bg-blue-50/50">
              <td className="px-3 py-2.5 font-bold text-primary">Paid 소계</td>
              <td className="px-3 py-2.5 text-right font-bold">{formatNumber(currentPaidUvs)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(prevPaidUvs)}</td>
              <td className={`px-3 py-2.5 text-right font-medium ${wowColor(wowPct(currentPaidUvs, prevPaidUvs))}`}>
                {fmtPct(wowPct(currentPaidUvs, prevPaidUvs))}
              </td>
              <td className="px-3 py-2.5 text-right font-bold">{currentLeads.paid}건</td>
              <td className="px-3 py-2.5 text-right font-bold">
                {paidCvr.toFixed(2)}%
                <span className={`ml-1 text-[10px] ${wowColor(paidCvr - prevPaidCvr)}`}>
                  ({paidCvr - prevPaidCvr > 0 ? '+' : ''}{(paidCvr - prevPaidCvr).toFixed(2)}%p)
                </span>
              </td>
            </tr>
            {/* Organic 소계 */}
            <tr className="bg-sky-50/50">
              <td className="px-3 py-2.5 font-bold text-sky-700">Organic 소계</td>
              <td className="px-3 py-2.5 text-right font-bold">{formatNumber(currentOrganicUvs)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(prevOrganicUvs)}</td>
              <td className={`px-3 py-2.5 text-right font-medium ${wowColor(wowPct(currentOrganicUvs, prevOrganicUvs))}`}>
                {fmtPct(wowPct(currentOrganicUvs, prevOrganicUvs))}
              </td>
              <td className="px-3 py-2.5 text-right font-bold">{currentLeads.organic}건</td>
              <td className="px-3 py-2.5 text-right font-bold">
                {organicCvr.toFixed(2)}%
                <span className={`ml-1 text-[10px] ${wowColor(organicCvr - prevOrganicCvr)}`}>
                  ({organicCvr - prevOrganicCvr > 0 ? '+' : ''}{(organicCvr - prevOrganicCvr).toFixed(2)}%p)
                </span>
              </td>
            </tr>
            {/* 전체 합계 */}
            <tr className="bg-muted/50 border-t border-border">
              <td className="px-3 py-2.5 font-bold">전체</td>
              <td className="px-3 py-2.5 text-right font-bold">{formatNumber(totalUvs)}</td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">{formatNumber(prevTotalUvs)}</td>
              <td className={`px-3 py-2.5 text-right font-medium ${wowColor(wowPct(totalUvs, prevTotalUvs))}`}>
                {fmtPct(wowPct(totalUvs, prevTotalUvs))}
              </td>
              <td className="px-3 py-2.5 text-right font-bold">{currentLeads.total}건</td>
              <td className="px-3 py-2.5 text-right font-bold">
                {totalCvr.toFixed(2)}%
                <span className={`ml-1 text-[10px] ${wowColor(totalCvr - prevTotalCvr)}`}>
                  ({totalCvr - prevTotalCvr > 0 ? '+' : ''}{(totalCvr - prevTotalCvr).toFixed(2)}%p)
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
