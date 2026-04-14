'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { formatNumber } from '@/src/lib/format';

/* ──────────────────────────── types ──────────────────────────── */

interface ChannelGroup { channel: string; sessions: number }
interface SessionSource { source: string; sessions: number }
interface GA4Data {
  totalVisitors: number;
  totalPageViews: number;
  channelGroups: ChannelGroup[];
  sessionSources: SessionSource[];
}

interface LeadRecord {
  create_date: string;
  x_studio_selection_field_8p8_1i3up6bfn?: string | false;
}

type DateRange = '7d' | '30d' | 'month';

/* ──────────────────────────── helpers ─────────────────────────── */

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getRange(range: DateRange): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (range === '7d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { startDate: fmtDate(start), endDate: 'yesterday', label: '최근 7일' };
  }
  if (range === '30d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { startDate: fmtDate(start), endDate: 'yesterday', label: '최근 30일' };
  }
  // 이번 달
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: fmtDate(start), endDate: 'yesterday', label: '이번 달' };
}

function getMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return {
    startDate: `${fmtDate(start)} 00:00:00`,
    endDate: `${fmtDate(end)} 23:59:59`,
  };
}

/* ──────────────────────────── constants ───────────────────────── */

const SOURCE_FIELD = 'x_studio_selection_field_8p8_1i3up6bfn';

const CHANNEL_COLORS = [
  '#3b82f6', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e',
  '#eab308', '#f97316', '#ef4444', '#a855f7', '#64748b',
];

const PIE_COLORS = ['#3b82f6', '#22c55e', '#94a3b8'];

/* ──────────────────────────── component ──────────────────────── */

export default function FunnelPage() {
  const [range, setRange] = useState<DateRange>('30d');
  const [ga4, setGa4] = useState<GA4Data | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = getRange(range);
  const monthRange = getMonthRange();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/ga4report?startDate=${startDate}&endDate=${endDate}`).then(r => r.json()),
      fetch(`/api/leads?action=monthly&startDate=${encodeURIComponent(monthRange.startDate)}&endDate=${encodeURIComponent(monthRange.endDate)}`).then(r => r.json()),
    ])
      .then(([gaRes, leadRes]) => {
        if (cancelled) return;
        if (gaRes.error) throw new Error(gaRes.error);
        setGa4(gaRes);
        setLeads(leadRes.records || []);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [startDate, endDate, monthRange.startDate, monthRange.endDate]);

  /* derived data */
  const totalSessions = useMemo(
    () => (ga4?.channelGroups || []).reduce((s, g) => s + g.sessions, 0),
    [ga4],
  );

  const avgPagesPerSession = useMemo(
    () => ga4 && ga4.totalVisitors > 0 ? (ga4.totalPageViews / ga4.totalVisitors) : 0,
    [ga4],
  );

  const { paidLeads, organicLeads, dailyLeads } = useMemo(() => {
    let paid = 0;
    let organic = 0;
    const dailyMap: Record<string, number> = {};

    leads.forEach(r => {
      const src = String(r[SOURCE_FIELD] || '').toLowerCase();
      if (src === 'paid') paid += 1;
      else organic += 1;

      const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z');
      const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
      const day = fmtDate(kst);
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });

    const dailyArr = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: date.slice(5), // MM-DD
        count,
      }));

    return { paidLeads: paid, organicLeads: organic, dailyLeads: dailyArr };
  }, [leads]);

  const conversionRate = useMemo(
    () => ga4 && ga4.totalVisitors > 0 ? ((leads.length / ga4.totalVisitors) * 100) : 0,
    [ga4, leads],
  );

  const pieData = useMemo(() => [
    { name: 'Paid', value: paidLeads },
    { name: 'Organic', value: organicLeads },
  ].filter(d => d.value > 0), [paidLeads, organicLeads]);

  /* ──────────────────────── render ────────────────────────────── */

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/kpis" className="text-sm text-primary hover:underline">&larr; GA 리포트</Link>
            <h1 className="text-2xl font-bold">풀퍼널 대시보드</h1>
          </div>

          {/* 기간 선택 */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {([['7d', '최근 7일'], ['30d', '최근 30일'], ['month', '이번 달']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRange(val)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === val
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* funnel flow indicator */}
        <div className="flex items-center justify-center gap-0 overflow-x-auto pb-2">
          {[
            { label: '인입', sub: 'Sessions', color: 'bg-blue-500' },
            { label: 'UX', sub: 'Clarity', color: 'bg-purple-500' },
            { label: '전환', sub: 'Conversions', color: 'bg-green-500' },
            { label: '매출', sub: 'Revenue', color: 'bg-orange-500' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className={`${step.color} text-white rounded-full w-10 h-10 flex items-center justify-center text-sm font-bold`}>
                  {i + 1}
                </div>
                <span className="text-sm font-semibold">{step.label}</span>
                <span className="text-[11px] text-muted-foreground">{step.sub}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="mx-3 flex items-center text-muted-foreground/50">
                  <div className="w-8 h-[2px] bg-border" />
                  <svg className="w-3 h-3 -ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* loading / error */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-muted-foreground">데이터를 불러오는 중...</div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-red-500">
            오류: {error}
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ───── 1. 인입 (Sessions) ───── */}
            <div className="rounded-xl border-2 border-blue-200 bg-card shadow-sm overflow-hidden">
              <div className="bg-blue-50 dark:bg-blue-950/30 px-5 py-3 border-b border-blue-200 flex items-center gap-2">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</div>
                <h2 className="font-bold text-blue-700 dark:text-blue-300">인입 (Sessions)</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* 총 세션 */}
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">총 세션</p>
                  <p className="text-3xl font-bold text-blue-600">{formatNumber(totalSessions)}</p>
                  <p className="text-xs text-muted-foreground mt-1">방문자 {formatNumber(ga4?.totalVisitors || 0)}명</p>
                </div>

                {/* 채널별 세션 바 차트 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">채널별 세션</h3>
                  {ga4 && ga4.channelGroups.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={ga4.channelGroups}
                        margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                        <XAxis dataKey="channel" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value) => [formatNumber(Number(value)), '세션']}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Bar dataKey="sessions" radius={[3, 3, 0, 0]}>
                          {ga4.channelGroups.map((_, i) => (
                            <Cell key={i} fill={CHANNEL_COLORS[i % CHANNEL_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">데이터 없음</p>
                  )}
                </div>

                {/* Top 5 소스 테이블 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">Top 5 유입 소스</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">소스</th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">세션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ga4?.sessionSources || []).slice(0, 5).map((s, i) => (
                        <tr key={s.source} className="border-b border-border last:border-0">
                          <td className="py-1.5 px-2 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                            <span className="font-medium">{s.source}</span>
                          </td>
                          <td className="py-1.5 px-2 text-right">{formatNumber(s.sessions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ───── 2. UX 인사이트 (Clarity) ───── */}
            <div className="rounded-xl border-2 border-purple-200 bg-card shadow-sm overflow-hidden">
              <div className="bg-purple-50 dark:bg-purple-950/30 px-5 py-3 border-b border-purple-200 flex items-center gap-2">
                <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</div>
                <h2 className="font-bold text-purple-700 dark:text-purple-300">UX 인사이트 (Clarity)</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* GA4 지표 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border p-4 text-center">
                    <p className="text-sm text-muted-foreground">평균 페이지뷰/세션</p>
                    <p className="text-2xl font-bold text-purple-600">{avgPagesPerSession.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4 text-center">
                    <p className="text-sm text-muted-foreground">총 페이지뷰</p>
                    <p className="text-2xl font-bold text-purple-600">{formatNumber(ga4?.totalPageViews || 0)}</p>
                  </div>
                </div>

                {/* Clarity 플레이스홀더 */}
                <div className="rounded-lg border border-dashed border-purple-300 bg-purple-50/50 dark:bg-purple-950/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <h3 className="font-semibold text-purple-700 dark:text-purple-300">Microsoft Clarity</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Clarity 대시보드에서 히트맵, 세션 녹화, 분노 클릭 등을 확인하세요
                  </p>
                  <a
                    href="https://clarity.microsoft.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
                  >
                    Clarity 열기
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {/* 추가 안내 */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clarity는 별도 API를 제공하지 않아 직접 연동이 불가합니다. 위 링크에서 실시간 세션 녹화, 히트맵, 인사이트 대시보드를 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {/* ───── 3. 전환 (Conversions) ───── */}
            <div className="rounded-xl border-2 border-green-200 bg-card shadow-sm overflow-hidden">
              <div className="bg-green-50 dark:bg-green-950/30 px-5 py-3 border-b border-green-200 flex items-center gap-2">
                <div className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</div>
                <h2 className="font-bold text-green-700 dark:text-green-300">전환 (Conversions)</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* 핵심 지표 */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">이번 달 리드</p>
                    <p className="text-2xl font-bold text-green-600">{formatNumber(leads.length)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">전환율</p>
                    <p className="text-2xl font-bold text-green-600">{conversionRate.toFixed(2)}%</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Paid / Organic</p>
                    <p className="text-lg font-bold">
                      <span className="text-blue-600">{paidLeads}</span>
                      <span className="text-muted-foreground mx-1">/</span>
                      <span className="text-green-600">{organicLeads}</span>
                    </p>
                  </div>
                </div>

                {/* Paid vs Organic 파이 */}
                {pieData.length > 0 && (
                  <div className="flex items-center justify-center">
                    <div className="w-[180px] h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            innerRadius={40}
                            strokeWidth={2}
                            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatNumber(Number(value)) + '건', '']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* 일별 리드 바 차트 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">일별 리드 추이 (이번 달)</h3>
                  {dailyLeads.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={dailyLeads}
                        margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.max(0, Math.floor(dailyLeads.length / 10))} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value) => [Number(value) + '건', '리드']}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Bar dataKey="count" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">이번 달 리드 데이터가 없습니다</p>
                  )}
                </div>
              </div>
            </div>

            {/* ───── 4. 매출 (Revenue) ───── */}
            <div className="rounded-xl border-2 border-orange-200 bg-card shadow-sm overflow-hidden">
              <div className="bg-orange-50 dark:bg-orange-950/30 px-5 py-3 border-b border-orange-200 flex items-center gap-2">
                <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</div>
                <h2 className="font-bold text-orange-700 dark:text-orange-300">매출 (Revenue)</h2>
              </div>
              <div className="p-5 flex flex-col items-center justify-center min-h-[300px] space-y-4">
                <div className="rounded-full bg-orange-100 dark:bg-orange-950/30 p-5">
                  <svg className="w-12 h-12 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-orange-600">매출 데이터 연동 준비 중</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Odoo 또는 결제 시스템 연동 후 표시됩니다
                  </p>
                </div>
                <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-950/20 p-4 text-xs text-muted-foreground space-y-1 w-full max-w-xs">
                  <p className="font-medium text-orange-600">예정 연동 항목:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>월별 매출 추이</li>
                    <li>리드당 매출 (AOV)</li>
                    <li>채널별 ROAS</li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
