'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatNumber } from '@/src/lib/format';

interface TrendDataPoint {
  date: string;
  visitors: number;
}

interface VisitorTrendChartProps {
  data: TrendDataPoint[];
  loading?: boolean;
}

function formatDate(raw: string): string {
  const m = parseInt(raw.slice(4, 6));
  const d = parseInt(raw.slice(6, 8));
  return `${m}/${d}`;
}

export function VisitorTrendChart({ data, loading }: VisitorTrendChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">방문자 트렌드</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            데이터 로딩 중...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) return null;

  const maxVisitors = Math.max(...data.map((d) => d.visitors));
  const total = data.reduce((sum, d) => sum + d.visitors, 0);
  const avg = Math.round(total / data.length);

  const labelInterval = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">방문자 트렌드</CardTitle>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>
              합계 <span className="font-bold text-foreground">{formatNumber(total)}</span>
            </span>
            <span>
              일평균 <span className="font-bold text-foreground">{formatNumber(avg)}</span>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px] h-48">
          {data.map((point, i) => {
            const heightPct = maxVisitors > 0 ? (point.visitors / maxVisitors) * 100 : 0;
            return (
              <div key={point.date} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-full mb-1 hidden group-hover:block bg-foreground text-background text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                  {formatDate(point.date)}: {formatNumber(point.visitors)}명
                </div>
                <div
                  className="w-full rounded-t-sm bg-primary/70 hover:bg-primary transition-colors min-h-[2px]"
                  style={{ height: `${heightPct}%` }}
                />
                {i % labelInterval === 0 && (
                  <span className="text-[10px] text-muted-foreground mt-1 leading-none">
                    {formatDate(point.date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
