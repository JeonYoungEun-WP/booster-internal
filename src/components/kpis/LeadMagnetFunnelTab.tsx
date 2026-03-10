'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowDown, Users, UserPlus, Mail, PhoneCall, Sprout, Handshake, Monitor, BookOpen, Lightbulb, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatNumber } from '@/src/lib/format';
import { useGA4Data } from '@/src/hooks/useGA4Data';
import { useImwebSignups } from '@/src/hooks/useImweb';
import { useLeadFunnel } from '@/src/hooks/useLeadFunnel';
import { VisitorTrendChart } from './VisitorTrendChart';

interface FunnelStage {
  id: string;
  label: string;
  sublabel: string;
  count: number;
  icon: React.ReactNode;
  color: string;
}

const PERIOD_OPTIONS = [
  { value: 'lastWeek', label: '지난 주' },
  { value: '7d', label: '최근 7일' },
  { value: '14d', label: '최근 14일' },
  { value: '30d', label: '최근 30일' },
  { value: '90d', label: '최근 90일' },
  { value: 'all', label: '전체 기간' },
  { value: 'custom', label: '날짜 선택' },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]['value'];

export function LeadMagnetFunnelTab() {
  const [period, setPeriod] = useState<PeriodValue>('lastWeek');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // 데이터 소스 hooks
  const { data: ga4Data, loading: ga4Loading, error: ga4Error } = useGA4Data(period, customStart, customEnd);
  const { signupCount: imwebSignups, loading: imwebLoading, error: imwebError } = useImwebSignups(period, customStart, customEnd);
  const { inquiryCount, nurturingCount, consultationCount, stages: odooStages, loading: odooLoading, error: odooError } = useLeadFunnel(period, customStart, customEnd);

  const anyLoading = ga4Loading || imwebLoading || odooLoading;

  // 퍼널 데이터 계산
  const { topStage, simTrack, ebookTrack, insightTrack } = useMemo(() => {
    const siteVisitors = ga4Data?.totalVisitors ?? 0;
    const trackSessions = ga4Data?.trackPageSessions ?? { simulator: 0, ebook: 0, insight: 0 };

    // 트랙별 페이지 도달 (GA4 실데이터)
    const simPageSessions = trackSessions.simulator;
    const ebookPageSessions = trackSessions.ebook;
    const insightPageSessions = trackSessions.insight;
    const totalTrackSessions = simPageSessions + ebookPageSessions + insightPageSessions;

    // 트랙별 비율 (페이지도달 기반)
    const simRatio = totalTrackSessions > 0 ? simPageSessions / totalTrackSessions : 0;
    const ebookRatio = totalTrackSessions > 0 ? ebookPageSessions / totalTrackSessions : 0;
    const insightRatio = totalTrackSessions > 0 ? insightPageSessions / totalTrackSessions : 0;

    // 가입 수 분배 (IMWEB 실데이터)
    const simSignups = Math.round(imwebSignups * simRatio);
    const ebookSignups = Math.round(imwebSignups * ebookRatio);
    const insightSignups = Math.round(imwebSignups * insightRatio);

    // 이메일 수 (샘플값, 추후 연동)
    const emailTotal = 11;
    const simEmails = Math.round(emailTotal * simRatio);
    const ebookEmails = Math.round(emailTotal * ebookRatio);
    const insightEmails = Math.round(emailTotal * insightRatio);

    // Odoo 데이터 트랙별 분배
    const simInquiries = Math.round(inquiryCount * simRatio);
    const ebookInquiries = Math.round(inquiryCount * ebookRatio);
    const insightInquiries = Math.round(inquiryCount * insightRatio);

    const simNurturing = Math.round(nurturingCount * simRatio);
    const ebookNurturing = Math.round(nurturingCount * ebookRatio);
    const insightNurturing = Math.round(nurturingCount * insightRatio);

    const simConsultation = Math.round(consultationCount * simRatio);
    const ebookConsultation = Math.round(consultationCount * ebookRatio);
    const insightConsultation = Math.round(consultationCount * insightRatio);

    const top: FunnelStage = {
      id: 'visitors',
      label: '사이트 방문자 (GA4)',
      sublabel: '유입 & 탐색',
      count: siteVisitors,
      icon: <Users className="h-5 w-5" />,
      color: 'hsl(var(--primary))',
    };

    const buildTrack = (
      prefix: string,
      icon: React.ReactNode,
      pageLbl: string,
      pageSub: string,
      pageCount: number,
      signup: number,
      email: number,
      inquiries: number,
      nurturing: number,
      consultation: number,
    ): FunnelStage[] => [
      { id: `${prefix}_page`, label: pageLbl, sublabel: pageSub, count: pageCount, icon, color: 'hsl(var(--primary))' },
      { id: `${prefix}_signup`, label: '가입', sublabel: 'IMWEB 회원가입', count: signup, icon: <UserPlus className="h-5 w-5" />, color: 'hsl(var(--accent-foreground))' },
      { id: `${prefix}_email`, label: '이메일 확보', sublabel: '웹폼 수집', count: email, icon: <Mail className="h-5 w-5" />, color: 'hsl(var(--accent-foreground))' },
      { id: `${prefix}_inquiry`, label: '문의 접수', sublabel: 'Odoo CRM', count: inquiries, icon: <PhoneCall className="h-5 w-5" />, color: '#F59E0B' },
      { id: `${prefix}_nurturing`, label: '육성', sublabel: 'Odoo 리드 단계', count: nurturing, icon: <Sprout className="h-5 w-5" />, color: '#10B981' },
      { id: `${prefix}_consultation`, label: '상담완료', sublabel: 'Odoo 클로징', count: consultation, icon: <Handshake className="h-5 w-5" />, color: '#F97316' },
    ];

    return {
      topStage: top,
      simTrack: buildTrack('sim', <Monitor className="h-5 w-5" />, '페이지도달 : 시뮬레이터', '시뮬레이터 랜딩 (URL 미설정)', simPageSessions, simSignups, simEmails, simInquiries, simNurturing, simConsultation),
      ebookTrack: buildTrack('ebook', <BookOpen className="h-5 w-5" />, '페이지도달 : 전자북', '/mk-skill-kit 하위', ebookPageSessions, ebookSignups, ebookEmails, ebookInquiries, ebookNurturing, ebookConsultation),
      insightTrack: buildTrack('insight', <Lightbulb className="h-5 w-5" />, '페이지도달 : 인사이트', '/case-study + /insight 하위', insightPageSessions, insightSignups, insightEmails, insightInquiries, insightNurturing, insightConsultation),
    };
  }, [ga4Data, imwebSignups, inquiryCount, nurturingCount, consultationCount]);

  const sections = [
    { title: '2. 가입 (Signup)', indices: [1] },
    { title: '3. 이메일 확보', indices: [2] },
    { title: '4. 문의 접수 (Inquiry)', indices: [3] },
    { title: '5. 육성 (Nurturing)', indices: [4] },
    { title: '6. 상담완료 (Closing)', indices: [5] },
  ];

  const calcRate = (from: number, to: number) => from > 0 ? (to / from) * 100 : 0;

  const simFinal = simTrack[simTrack.length - 1].count;
  const ebookFinal = ebookTrack[ebookTrack.length - 1].count;
  const insightFinal = insightTrack[insightTrack.length - 1].count;
  const grandTotal = simFinal + ebookFinal + insightFinal;
  const overallRate = topStage.count > 0 ? ((grandTotal / topStage.count) * 100).toFixed(2) : '0.00';

  const emailTotal = 11; // 샘플값

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">리드마그넷 퍼널</h2>
          <p className="text-sm text-muted-foreground mt-1">
            사이트 방문 &rarr; 페이지도달 &rarr; 가입 &rarr; 이메일 확보 &rarr; 문의 접수 &rarr; 육성 &rarr; 상담완료
          </p>
        </div>
        <div className="relative" ref={datePickerRef}>
          <select
            value={period}
            onChange={(e) => {
              const val = e.target.value as PeriodValue;
              setPeriod(val);
              if (val === 'custom') {
                setShowDatePicker(true);
              } else {
                setShowDatePicker(false);
              }
            }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value === 'custom' && customStart && customEnd && period === 'custom'
                  ? `${customStart} ~ ${customEnd}`
                  : opt.label}
              </option>
            ))}
          </select>

          {showDatePicker && period === 'custom' && (
            <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border bg-card shadow-lg p-4 min-w-[300px]">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">기간 선택</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">시작일</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">종료일</label>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                disabled={!customStart || !customEnd}
                className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                적용
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards — 6단계 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="방문자 (GA4)" value={topStage.count} loading={ga4Loading} />
        <SummaryCard label="가입 (IMWEB)" value={imwebSignups} rate={calcRate(topStage.count, imwebSignups)} loading={imwebLoading} />
        <SummaryCard label="이메일 확보" value={emailTotal} rate={calcRate(imwebSignups, emailTotal)} subtitle="샘플값" />
        <SummaryCard label="문의 접수 (Odoo)" value={inquiryCount} rate={calcRate(imwebSignups + emailTotal, inquiryCount)} loading={odooLoading} />
        <SummaryCard label="육성 (Odoo)" value={nurturingCount} rate={calcRate(inquiryCount, nurturingCount)} loading={odooLoading} />
        <SummaryCard label="상담완료 (Odoo)" value={consultationCount} rate={calcRate(nurturingCount, consultationCount)} loading={odooLoading} highlight />
      </div>

      {/* 에러 표시 */}
      {ga4Error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          GA4 데이터 로드 실패: {ga4Error}
        </div>
      )}
      {imwebError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          IMWEB 데이터 로드 실패: {imwebError}
        </div>
      )}
      {odooError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          Odoo 데이터 로드 실패: {odooError}
        </div>
      )}

      {/* Odoo 리드 단계 분포 */}
      {!odooLoading && odooStages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Odoo 리드 단계별 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {odooStages.map((s) => (
                <span key={s.name} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">{s.count}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <VisitorTrendChart data={ga4Data?.dailyTrend ?? []} loading={ga4Loading} />

      {/* 퍼널 단계별 현황 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">퍼널 단계별 현황</CardTitle>
            <span className="text-sm text-muted-foreground">
              전체 전환율: <span className="font-bold text-primary">{overallRate}%</span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                1. 유입 &amp; 탐색 (Acquisition)
              </p>
              <StageBar stage={topStage} isLast={false} />
              <p className="text-sm text-muted-foreground mt-2">
                총 가입자 수: <span className="font-bold text-foreground">{formatNumber(imwebSignups + emailTotal)}명</span>
                <span className="text-xs ml-2">(가입 {formatNumber(imwebSignups)} + 이메일 {formatNumber(emailTotal)})</span>
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 py-1">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">3개 트랙으로 분기</span>
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TrackColumn
                title="시뮬레이터 트랙"
                trackColor="hsl(var(--primary))"
                track={simTrack}
                topCount={topStage.count}
                sections={sections}
                calcRate={calcRate}
              />
              <TrackColumn
                title="전자북 트랙"
                trackColor="hsl(var(--accent-foreground))"
                track={ebookTrack}
                topCount={topStage.count}
                sections={sections}
                calcRate={calcRate}
              />
              <TrackColumn
                title="인사이트 트랙"
                trackColor="#8B5CF6"
                track={insightTrack}
                topCount={topStage.count}
                sections={sections}
                calcRate={calcRate}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 단계별 전환율 상세 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">단계별 전환율 상세</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">트랙</th>
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">구간</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">이전</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">다음</th>
                  <th className="text-right py-2 px-4 font-medium text-muted-foreground">전환율</th>
                  <th className="text-right py-2 pl-4 font-medium text-muted-foreground">이탈률</th>
                </tr>
              </thead>
              <tbody>
                <ConversionRows label="시뮬레이터" topStage={topStage} track={simTrack} calcRate={calcRate} />
                <ConversionRows label="전자북" topStage={topStage} track={ebookTrack} calcRate={calcRate} />
                <ConversionRows label="인사이트" topStage={topStage} track={insightTrack} calcRate={calcRate} />
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, rate, highlight = false, loading = false, subtitle }: {
  label: string;
  value: number;
  rate?: number;
  highlight?: boolean;
  loading?: boolean;
  subtitle?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${highlight ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card'}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg sm:text-2xl font-bold ${highlight ? 'text-orange-500' : 'text-foreground'}`}>
        {loading ? <span className="text-muted-foreground animate-pulse">···</span> : formatNumber(value)}
      </p>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>
      )}
      {rate !== undefined && !loading && (
        <p className="text-xs text-muted-foreground mt-1">전환율 <span className="font-semibold text-primary">{rate.toFixed(1)}%</span></p>
      )}
    </div>
  );
}

function StageBar({ stage, isLast }: { stage: FunnelStage; isLast: boolean }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-4 py-3 transition-all w-full"
        style={{
          backgroundColor: isLast ? 'hsl(24, 95%, 53%)' : `color-mix(in srgb, ${stage.color} 15%, transparent)`,
          border: isLast ? '2px solid hsl(24, 95%, 53%)' : `1px solid color-mix(in srgb, ${stage.color} 30%, transparent)`,
        }}
      >
        <span className="shrink-0" style={{ color: isLast ? 'white' : stage.color }}>{stage.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isLast ? 'text-white' : 'text-foreground'}`}>{stage.label}</p>
          <p className={`text-xs ${isLast ? 'text-white/70' : 'text-muted-foreground'}`}>{stage.sublabel}</p>
        </div>
        <span className={`text-lg font-bold whitespace-nowrap ${isLast ? 'text-white' : 'text-foreground'}`}>
          {formatNumber(stage.count)}{stage.id.includes('inquiry') || stage.id.includes('nurturing') || stage.id.includes('consultation') ? '건' : '명'}
        </span>
      </div>
    </div>
  );
}

function TrackColumn({
  title,
  trackColor,
  track,
  topCount,
  sections,
  calcRate,
}: {
  title: string;
  trackColor: string;
  track: FunnelStage[];
  topCount: number;
  sections: { title: string; indices: number[] }[];
  calcRate: (from: number, to: number) => number;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-0">
      <p className="text-sm font-bold mb-3" style={{ color: trackColor }}>{title}</p>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        페이지 도달
      </p>
      <StageBar stage={track[0]} isLast={false} />
      <ConversionArrow rate={calcRate(topCount, track[0].count)} isMajor />

      {sections.map((section, sIdx) => (
        <div key={sIdx}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-3">
            {section.title}
          </p>
          {section.indices.map((idx) => {
            const stage = track[idx];
            const prevCount = idx === 1 ? track[0].count : track[idx - 1].count;
            const rate = calcRate(prevCount, stage.count);
            const isLast = idx === track.length - 1;

            return (
              <div key={stage.id}>
                {idx > 0 && section.indices[0] === idx && (
                  <ConversionArrow rate={rate} isMajor />
                )}
                {idx > 0 && section.indices[0] !== idx && (
                  <ConversionArrow rate={rate} isMajor={false} />
                )}
                <StageBar stage={stage} isLast={isLast} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ConversionArrow({ rate, isMajor }: { rate: number; isMajor: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <ArrowDown className={isMajor ? 'h-4 w-4 text-muted-foreground' : 'h-3 w-3 text-muted-foreground/60'} />
      <span className={isMajor ? 'text-xs font-medium text-muted-foreground' : 'text-[11px] text-muted-foreground/60'}>
        {isMajor ? `전환율 ${rate.toFixed(1)}%` : `${rate.toFixed(1)}%`}
      </span>
    </div>
  );
}

function ConversionRows({
  label,
  topStage,
  track,
  calcRate,
}: {
  label: string;
  topStage: FunnelStage;
  track: FunnelStage[];
  calcRate: (from: number, to: number) => number;
}) {
  return (
    <>
      {track.map((stage, idx) => {
        const from = idx === 0 ? topStage : track[idx - 1];
        const rate = calcRate(from.count, stage.count);
        const dropOff = 100 - rate;
        return (
          <tr key={stage.id} className="border-b last:border-0">
            {idx === 0 && (
              <td className="py-2.5 pr-4 font-medium text-muted-foreground" rowSpan={track.length}>
                {label}
              </td>
            )}
            <td className="py-2.5 pr-4 font-medium">{from.label} &rarr; {stage.label}</td>
            <td className="py-2.5 px-4 text-right">{formatNumber(from.count)}</td>
            <td className="py-2.5 px-4 text-right">{formatNumber(stage.count)}</td>
            <td className="py-2.5 px-4 text-right font-semibold text-primary">{rate.toFixed(1)}%</td>
            <td className={`py-2.5 pl-4 text-right font-medium ${dropOff > 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {dropOff.toFixed(1)}%
            </td>
          </tr>
        );
      })}
    </>
  );
}
