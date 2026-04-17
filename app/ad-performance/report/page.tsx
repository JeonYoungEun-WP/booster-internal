'use client';

import { useEffect, useState } from 'react';
import { AdSubNav } from '@/src/components/ad-performance/SubNav';
import { DateRangePicker } from '@/src/components/ad-performance/DateRangePicker';
import { formatNumber } from '@/src/lib/format';
import { CHANNEL_COLOR, CHANNEL_LABEL, type AdChannel, type CampaignPerformance } from '@/src/lib/ad-data';

const ALL_CHANNELS: AdChannel[] = ['google', 'meta', 'naver', 'kakao'];

function offset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtKRW(n: number): string {
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}
function fmtPct(n: number): string {
  return n.toFixed(2) + '%';
}

type SortKey = 'cost' | 'clicks' | 'conversions' | 'cpa' | 'roas' | 'ctr' | 'cvr';

export default function AdPerformanceReport() {
  const [startDate, setStartDate] = useState(offset(29));
  const [endDate, setEndDate] = useState(offset(0));
  const [channels, setChannels] = useState<AdChannel[]>(ALL_CHANNELS);
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    const chQuery = channels.length === ALL_CHANNELS.length ? '' : `&channels=${channels.join(',')}`;
    fetch(`/api/ad-performance?view=campaigns&startDate=${startDate}&endDate=${endDate}${chQuery}`)
      .then((r) => r.json())
      .then((d) => { setCampaigns(d.campaigns || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [startDate, endDate, channels]);

  const toggleChannel = (ch: AdChannel) => {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  };

  const sorted = [...campaigns].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const sortIcon = (k: SortKey) => sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const exportCSV = () => {
    const headers = ['캠페인', '채널', '상태', '노출', '클릭', 'CTR', '비용', 'CPC', '전환', 'CVR', 'CPA', 'ROAS'];
    const rows = sorted.map((c) => [
      c.campaignName, CHANNEL_LABEL[c.channel], c.status,
      c.impressions, c.clicks, c.ctr.toFixed(2),
      c.cost, c.cpc.toFixed(0), c.conversions,
      c.cvr.toFixed(2), c.cpa.toFixed(0), c.roas.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ad-report-${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">광고 리포트</h1>
          <p className="text-sm text-muted-foreground mt-1">캠페인 단위 상세 성과 + CSV 다운로드</p>
        </div>

        <AdSubNav />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
            <div className="flex gap-1 ml-2">
              {ALL_CHANNELS.map((ch) => {
                const on = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: CHANNEL_COLOR[ch] }} />
                    {CHANNEL_LABEL[ch]}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={exportCSV} className="text-sm rounded-md border border-border px-3 py-1.5 hover:bg-muted">
            CSV 다운로드
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 px-3">캠페인</th>
                    <th className="py-2 px-3">채널</th>
                    <th className="py-2 px-3">상태</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('cost')}>비용{sortIcon('cost')}</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('clicks')}>클릭{sortIcon('clicks')}</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('ctr')}>CTR{sortIcon('ctr')}</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('conversions')}>전환{sortIcon('conversions')}</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('cvr')}>CVR{sortIcon('cvr')}</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('cpa')}>CPA{sortIcon('cpa')}</th>
                    <th className="py-2 px-3 text-right cursor-pointer" onClick={() => handleSort('roas')}>ROAS{sortIcon('roas')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, i) => (
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
                      <td className="py-2 px-3 text-right">{fmtPct(c.ctr)}</td>
                      <td className="py-2 px-3 text-right">{formatNumber(c.conversions)}</td>
                      <td className="py-2 px-3 text-right">{fmtPct(c.cvr)}</td>
                      <td className="py-2 px-3 text-right">{fmtKRW(c.cpa)}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${c.roas >= 200 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtPct(c.roas)}</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan={10} className="py-10 text-center text-muted-foreground">데이터가 없습니다</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
