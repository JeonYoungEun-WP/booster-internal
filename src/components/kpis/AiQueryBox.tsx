'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatNumber } from '@/src/lib/format';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#eab308', '#64748b'];

const EXAMPLES = [
  '이번 주 트래픽 요약해줘',
  '채널별 이탈률 분석해줘',
  '전환율 개선 방안 제안해줘',
  '오가닉 유입 추이 분석해줘',
  '지난 30일 페이지별 성과 분석',
];

interface SeriesDef { key: string; label: string; color?: string }
interface ChartBlock {
  title: string;
  type: 'bar' | 'line' | 'pie';
  data: { label: string; value: number; value2?: number; value3?: number; value4?: number }[];
  series?: SeriesDef[];
  valueLabel?: string;
  value2Label?: string;
}

function InlineChart({ chart }: { chart: ChartBlock }) {
  if (chart.type === 'pie') {
    return (
      <div className="my-3 rounded-lg border border-border bg-background p-4">
        <p className="text-sm font-semibold mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={80}
              label={({ name, value }) => `${name}: ${formatNumber(Number(value))}`}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatNumber(Number(v))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }
  // 시리즈 정의: series가 있으면 사용, 없으면 기존 value/value2 방식
  const seriesList: SeriesDef[] = chart.series || [
    { key: 'value', label: chart.valueLabel || '값', color: CHART_COLORS[0] },
    ...(chart.data.some(d => d.value2 !== undefined) ? [{ key: 'value2', label: chart.value2Label || '비교', color: CHART_COLORS[1] }] : []),
  ];

  const ChartComp = chart.type === 'line' ? LineChart : BarChart;
  return (
    <div className="my-3 rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-semibold mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={260}>
        <ChartComp data={chart.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatNumber(Number(v))} />
          {seriesList.map((s, i) => (
            chart.type === 'line' ? (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color || CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }}
                strokeDasharray={i >= 2 ? '5 5' : undefined} />
            ) : (
              <Bar key={s.key} dataKey={s.key} name={s.label}
                fill={s.color || CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
            )
          ))}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
}

const MD_CLASSES = `max-w-none text-sm leading-relaxed
  [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-sm
  [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
  [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1
  [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1
  [&_li]:leading-relaxed
  [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
  [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2
  [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1
  [&_p]:my-1.5 [&_strong]:font-bold
  [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs`;

export function AiQueryBox() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/chat' }), []);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage({ text: inputValue });
    setInputValue('');
  };

  const handleClear = () => {
    setMessages([]);
  };

  // tool invocation에서 차트 추출
  const getCharts = (parts: typeof messages[0]['parts']): ChartBlock[] => {
    const charts: ChartBlock[] = [];
    for (const part of parts) {
      // tool-chartData 타입 또는 dynamic-tool with toolName=chartData
      if (part.type === 'tool-chartData' || (part.type === 'dynamic-tool' && 'toolName' in part && (part as unknown as { toolName: string }).toolName === 'chartData')) {
        const p = part as unknown as { input?: unknown };
        if (p.input) {
          const args = p.input as ChartBlock;
          if (args?.data) charts.push(args);
        }
      }
    }
    return charts;
  };

  // 메시지에서 텍스트 추출
  const getTextContent = (parts: typeof messages[0]['parts']): string => {
    return parts
      .filter(p => p.type === 'text')
      .map(p => (p as { type: 'text'; text: string }).text)
      .join('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* 메시지 영역 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-muted-foreground text-sm mb-6">GA4, Odoo 데이터를 실시간으로 조회하여 분석합니다</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => setInputValue(ex)} className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === 'user') {
            const text = getTextContent(msg.parts);
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl px-4 py-3 bg-primary text-primary-foreground">
                  <p className="text-sm">{text}</p>
                </div>
              </div>
            );
          }

          const text = getTextContent(msg.parts);
          const charts = getCharts(msg.parts);
          const hasToolCalls = msg.parts.some(p => p.type === 'tool-invocation');
          const isThinking = hasToolCalls && !text;

          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[85%] rounded-xl px-4 py-3 bg-muted/50">
                {isThinking && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    데이터를 조회하고 분석하는 중...
                  </div>
                )}
                {text && (
                  <div className={MD_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                  </div>
                )}
                {charts.map((chart, i) => (
                  <InlineChart key={i} chart={chart} />
                ))}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted/50 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                데이터를 조회하고 분석하는 중...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 디버그: status 표시 */}
      {status !== 'ready' && (
        <div className="px-4 py-1 text-xs text-muted-foreground bg-muted/30 border-t border-border">
          상태: {status} | 메시지: {messages.length}개
        </div>
      )}

      {/* 하단 고정 입력창 */}
      <div className="sticky bottom-0 border-t border-border bg-card p-4">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <button onClick={handleClear} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              대화 초기화
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={messages.length === 0 ? '분석하고 싶은 내용을 입력하세요...' : '이어서 질문하세요...'}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !inputValue.trim()} className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
            {isLoading ? '분석 중...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  );
}
