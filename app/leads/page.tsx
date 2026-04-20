'use client';

import { useEffect, useState } from 'react';
import { useLeads, useMonthlyLeadCounts, usePlatformOptions, type MonthData } from '@/src/hooks/useLeads';

const PAGE_SIZE = 20;

const F: Record<string, string> = {
  industry: 'x_studio_selection_field_49m_1i3fcoqk9',
  product: 'x_studio_selection_field_45h_1i3fd9s90',
  platform: 'x_studio_selection_field_oo_1i57nj2og',
  source: 'x_studio_selection_field_8p8_1i3up6bfn',
  medium: 'x_studio_selection_field_5f4_1i3up2qg3',
  campaign: 'x_studio_',
  landing: 'x_studio_char_field_1vr_1i3fco0k9',
  keyword: 'x_studio_char_field_3ao_1i3fcoas5',
};

function val(v: unknown) {
  if (!v || v === false) return '-';
  if (Array.isArray(v)) return v[1] || '-';
  return String(v);
}

const COLUMNS = [
  { key: 'name', label: '리드명', align: 'left' as const },
  { key: 'partner_name', label: '고객', align: 'left' as const },
  { key: 'email_from', label: '이메일', align: 'left' as const },
  { key: 'expected_revenue', label: '예상 매출', align: 'right' as const },
  { key: 'stage_id', label: '단계', align: 'left' as const },
  { key: 'user_id', label: '담당자', align: 'left' as const },
  { key: F.industry, label: '업종', align: 'left' as const },
  { key: F.product, label: '관심상품', align: 'left' as const },
  { key: F.platform, label: '플랫폼', align: 'left' as const },
  { key: F.source, label: '유입경로', align: 'left' as const },
  { key: F.medium, label: '전달매체', align: 'left' as const },
  { key: F.campaign, label: '캠페인', align: 'left' as const },
  { key: F.landing, label: '랜딩', align: 'left' as const },
  { key: F.keyword, label: '키워드', align: 'left' as const },
  { key: 'create_date', label: '생성일', align: 'left' as const },
];

function SortArrow({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: string }) {
  if (field !== sortField) return <span className="ml-1 text-muted-foreground/40">&#8597;</span>;
  return <span className="ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
}

export default function LeadsPage() {
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState('create_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const monthly = useMonthlyLeadCounts();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const platformOptions = usePlatformOptions();

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const { data: leads, total, loading, error } = useLeads({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortField,
    sortDir,
    search,
    platform,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CRM 리드 관리</h1>
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="text-sm text-muted-foreground">
                총 {total.toLocaleString()}건
                <span className="ml-1 text-xs opacity-60">(Odoo)</span>
              </span>
            )}
            <button
              onClick={() => {
                fetch('/api/sync-leads').then(r => r.json()).then(r => {
                  alert(`동기화 완료: ${r.synced}건 (${r.mode})`);
                  window.location.reload();
                }).catch(() => alert('동기화 실패'));
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted/50"
            >
              동기화
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="리드명, 고객, 이메일, 랜딩, 키워드, 캠페인 검색..."
              className="w-full rounded-lg border border-border bg-card px-4 py-2 pr-10 text-sm shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                aria-label="검색어 지우기"
              >
                &#10005;
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm">
            <span className="whitespace-nowrap text-muted-foreground">플랫폼:</span>
            <select
              value={platform}
              onChange={(e) => { setPlatform(e.target.value); setPage(0); }}
              className="bg-transparent outline-none min-w-[120px]"
            >
              <option value="">전체</option>
              {platformOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        {!monthly.loading && monthly.months.length > 0 && (() => {
          const currentMonthData = monthly.months[0];
          const activeMonth = selectedMonth !== null
            ? monthly.months.find((m: MonthData) => m.month === selectedMonth)
            : currentMonthData;
          const displayMonth = activeMonth || currentMonthData;

          return (
            <>
              {/* 월 탭 - 컴팩트 칩 */}
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">{currentMonthData.year}</span>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = monthly.months.find((md: MonthData) => md.month === i);
                  const isActive = displayMonth.month === i;
                  const isFuture = !m;
                  const monthTotal = m ? Object.values(m.counts).reduce((a, b) => a + b, 0) : 0;
                  return (
                    <button
                      key={i}
                      disabled={isFuture}
                      onClick={() => !isFuture && setSelectedMonth(i === currentMonthData.month ? null : i)}
                      className={`relative rounded-md px-2 py-1 text-xs transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : isFuture
                          ? 'text-muted-foreground/30 cursor-default'
                          : 'border border-border hover:bg-muted/50'
                      }`}
                      title={m ? `${monthTotal}건` : ''}
                    >
                      {i + 1}월
                      {!isFuture && (
                        <span className={`ml-0.5 text-[10px] ${isActive ? 'opacity-80' : 'text-muted-foreground'}`}>
                          {monthTotal}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 선택된 월 달력 */}
              <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm text-center">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-1 py-2 font-medium text-left min-w-[50px]">{displayMonth.year}년 {displayMonth.month + 1}월</th>
                      {Array.from({ length: displayMonth.daysInMonth }, (_, i) => {
                        const dow = new Date(displayMonth.year, displayMonth.month, i + 1).getDay();
                        const color = dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : '';
                        return (
                          <th key={i} className={`px-1 py-2 font-medium min-w-[32px] ${color}`}>
                            {displayMonth.month + 1}/{i + 1}
                          </th>
                        );
                      })}
                      <th className="px-2 py-2 font-bold bg-muted">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-1 py-2 font-medium text-left">리드수</td>
                      {Array.from({ length: displayMonth.daysInMonth }, (_, i) => {
                        const count = displayMonth.counts[i + 1] || 0;
                        const dow = new Date(displayMonth.year, displayMonth.month, i + 1).getDay();
                        const isSunday = dow === 0;
                        return (
                          <td key={i} className={`px-1 py-2 ${isSunday ? 'text-red-500 font-semibold' : count > 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                            {count || '-'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 font-bold bg-muted">
                        {Object.values(displayMonth.counts).reduce((a, b) => a + b, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-red-500">
            Odoo 연결 오류: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-sm text-muted-foreground">데이터를 불러오는 중...</div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={`px-2 py-2 font-medium cursor-pointer select-none hover:bg-muted/80 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        <SortArrow field={col.key} sortField={sortField} sortDir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-10 text-center text-muted-foreground">
                        리드 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead.id as string} className="border-b border-border last:border-0 hover:bg-muted/30">
                        {COLUMNS.map((col) => {
                          const v = lead[col.key];
                          if (col.key === 'expected_revenue') {
                            return (
                              <td key={col.key} className="px-2 py-2 text-right">
                                {v ? Number(v).toLocaleString('ko-KR') + '원' : '-'}
                              </td>
                            );
                          }
                          if (col.key === F.source) {
                            return (
                              <td key={col.key} className={`px-2 py-2 ${v === 'organic' ? 'font-bold text-red-500' : ''}`}>
                                {val(v)}
                              </td>
                            );
                          }
                          if (col.key === F.landing) {
                            return (
                              <td key={col.key} className="px-2 py-2">
                                {v && v !== false && String(v).toLowerCase() !== 'none' ? (
                                  <a href={String(v)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{String(v)}</a>
                                ) : '-'}
                              </td>
                            );
                          }
                          if (col.key === 'create_date') {
                            return (
                              <td key={col.key} className="px-2 py-2 text-muted-foreground">
                                {v ? new Date(String(v).replace(' ', 'T') + 'Z').toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}
                              </td>
                            );
                          }
                          if (col.key === 'name') {
                            return <td key={col.key} className="px-2 py-2 font-medium">{val(v)}</td>;
                          }
                          return <td key={col.key} className="px-2 py-2">{val(v)}</td>;
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-40"
                >
                  이전
                </button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
