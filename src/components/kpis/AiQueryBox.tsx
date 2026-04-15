'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

interface ChartBlock {
  title: string;
  type: 'bar' | 'line' | 'pie';
  data: { label: string; value: number; value2?: number }[];
  valueLabel?: string;
  value2Label?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartBlock[];
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

  const ChartComp = chart.type === 'line' ? LineChart : BarChart;
  return (
    <div className="my-3 rounded-lg border border-border bg-background p-4">
      <p className="text-sm font-semibold mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <ChartComp data={chart.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e8eb" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => formatNumber(Number(v))} />
          {chart.type === 'line' ? (
            <>
              <Line type="monotone" dataKey="value" name={chart.valueLabel || '값'} stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              {chart.data.some(d => d.value2 !== undefined) && (
                <Line type="monotone" dataKey="value2" name={chart.value2Label || '비교'} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
              )}
            </>
          ) : (
            <>
              <Bar dataKey="value" name={chart.valueLabel || '값'} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              {chart.data.some(d => d.value2 !== undefined) && (
                <Bar dataKey="value2" name={chart.value2Label || '비교'} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              )}
            </>
          )}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
}

export function AiQueryBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setChatOpen(true);
    setLoading(true);

    // AI SDK 형식으로 메시지 변환
    // 이전 대화 맥락을 전달 (assistant 메시지는 500자로 제한, 빈 메시지 제외)
    const apiMessages = allMessages
      .filter(m => m.content.trim())
      .map(m => ({
        role: m.role,
        content: m.role === 'assistant' && m.content.length > 500
          ? m.content.slice(0, 500) + '...(이하 생략)'
          : m.content,
      }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) throw new Error('API error');

      const assistantId = (Date.now() + 1).toString();
      const charts: ChartBlock[] = [];

      // SSE 응답을 전체 텍스트로 읽기
      const raw = await res.text();

      // text-delta에서 텍스트 추출
      let fullText = '';
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') continue;
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'text-delta' && data.delta) {
            fullText += data.delta;
          } else if (data.type === 'tool-call' && data.toolName === 'chartData' && data.args) {
            charts.push(data.args as ChartBlock);
          }
        } catch { /* skip */ }
      }

      if (fullText || charts.length > 0) {
        setMessages([...allMessages, { id: assistantId, role: 'assistant', content: fullText, charts }]);
      } else {
        setMessages([...allMessages, { id: assistantId, role: 'assistant', content: '분석 결과를 생성할 수 없습니다.' }]);
      }
    } catch {
      setMessages([...allMessages, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '오류가 발생했습니다. 다시 시도해주세요.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleClear = () => {
    setMessages([]);
    setChatOpen(false);
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
                <button key={ex} onClick={() => setInput(ex)} className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50'}`}>
              {msg.content && (
                <div className="space-y-1.5">
                  {msg.content.split('\n').filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed">{line}</p>
                  ))}
                </div>
              )}
              {msg.charts?.map((chart, i) => (
                <InlineChart key={i} chart={chart} />
              ))}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === 'user' && (
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={messages.length === 0 ? '분석하고 싶은 내용을 입력하세요...' : '이어서 질문하세요...'}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap">
            {loading ? '분석 중...' : '전송'}
          </button>
        </form>
      </div>
    </div>
  );
}
