'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GA4YesterdayBanner } from '@/src/components/kpis/GA4YesterdayBanner';
import { SuspiciousTrafficBanner } from '@/src/components/kpis/SuspiciousTrafficBanner';
import { GA4SessionSourceTable } from '@/src/components/kpis/GA4SessionSourceTable';
import { LeadMagnetFunnelTab } from '@/src/components/kpis/LeadMagnetFunnelTab';

function AiQueryBox() {
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const examples = [
    '이번 주 이탈률이 높은 채널은?',
    '오가닉 검색 유입 추이 분석해줘',
    '전환율 개선 방안 제안해줘',
    '지난 7일 트래픽 요약해줘',
  ];

  const handleSubmit = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setReport(null);
    try {
      const [ga7d, ga30d, leads] = await Promise.all([
        fetch('/api/ga4report?startDate=7daysAgo&endDate=yesterday').then(r => r.json()),
        fetch('/api/ga4report?startDate=30daysAgo&endDate=yesterday').then(r => r.json()),
        fetch(`/api/leads?action=monthly&startDate=${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01 00:00:00&endDate=${new Date().toISOString().slice(0,10)} 23:59:59`).then(r => r.json()),
      ]);

      const leadCount = leads.records?.length || 0;
      const paidLeads = leads.records?.filter((r: { x_studio_selection_field_8p8_1i3up6bfn?: string }) => String(r.x_studio_selection_field_8p8_1i3up6bfn || '').toLowerCase() === 'paid').length || 0;

      const context = `[최근 7일 GA4 데이터]
총사용자: ${ga7d.totalVisitors}, 총PV: ${ga7d.totalPageViews}, PV/사용자: ${(ga7d.totalPageViews/ga7d.totalVisitors).toFixed(1)}
채널별 세션: ${ga7d.channelGroups?.map((c:{channel:string;sessions:number}) => c.channel+':'+c.sessions).join(', ')}
소스별 세션: ${ga7d.sessionSources?.map((s:{source:string;sessions:number}) => s.source+':'+s.sessions).join(', ')}
일별 방문자: ${ga7d.dailyTrend?.map((d:{date:string;visitors:number}) => d.date.slice(4)+':'+d.visitors).join(', ')}
이벤트: ${ga7d.events?.sort((a:{count:number},b:{count:number}) => b.count-a.count).slice(0,15).map((e:{event:string;count:number;users:number}) => e.event+':'+e.count+'회/'+e.users+'명').join(', ')}
Clarity: ${JSON.stringify(ga7d.clarityEvents || {})}
전환이벤트: ${JSON.stringify(ga7d.conversionEvents || {})}

[최근 30일 GA4 데이터]
총사용자: ${ga30d.totalVisitors}, 총PV: ${ga30d.totalPageViews}
채널별: ${ga30d.channelGroups?.map((c:{channel:string;sessions:number}) => c.channel+':'+c.sessions).join(', ')}

[이번 달 리드]
총 리드: ${leadCount}건, Paid: ${paidLeads}건, Organic: ${leadCount - paidLeads}건
전환율: ${ga7d.totalVisitors > 0 ? (leadCount/ga7d.totalVisitors*100).toFixed(2) : 0}%`;

      const res = await fetch('/api/ga4report/weekly/ai-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customQuery: query,
          context,
        }),
      });
      const data = await res.json();
      setReport(data.comment || '분석 결과를 생성할 수 없습니다.');
    } catch {
      setReport('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h2 className="font-semibold text-sm">AI 데이터 분석</h2>
        <span className="text-xs text-muted-foreground">GA4 + Odoo 데이터 기반</span>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="분석하고 싶은 내용을 입력하세요..."
          className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? '분석 중...' : '분석'}
        </button>
      </div>

      {!report && !loading && (
        <div className="flex flex-wrap gap-2 mt-3">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => { setQuery(ex); }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
          ))}
        </div>
      )}

      {report && (
        <div className="mt-4 rounded-lg bg-muted/30 p-4">
          <div className="space-y-2">
            {report.split('\n').filter(l => l.trim()).map((line, i) => (
              <p key={i} className="text-sm text-foreground leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function KPIsPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">GA 리포트</h1>
          <div className="flex gap-2">
            <Link
              href="/kpis/funnel"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              풀퍼널 분석
            </Link>
            <Link
              href="/kpis/weekly-report"
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              주간 리포트
            </Link>
          </div>
        </div>
        <AiQueryBox />
        <section className="space-y-4">
          <GA4YesterdayBanner />
          <SuspiciousTrafficBanner />
          <GA4SessionSourceTable />
        </section>
        <LeadMagnetFunnelTab />
      </div>
    </div>
  );
}
