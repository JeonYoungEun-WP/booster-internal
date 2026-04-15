'use client';

import Link from 'next/link';
import { AiQueryBox } from '@/src/components/kpis/AiQueryBox';

export default function AiAnalysisPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* 상단 네비게이션 */}
        <div className="flex items-center gap-3 text-sm">
          <Link href="/kpis" className="text-primary hover:underline">&larr; GA 리포트</Link>
          <span className="text-muted-foreground">|</span>
          <Link href="/kpis/funnel" className="text-muted-foreground hover:text-foreground">풀퍼널 분석</Link>
          <Link href="/kpis/weekly-report" className="text-muted-foreground hover:text-foreground">주간 리포트</Link>
        </div>

        {/* 타이틀 */}
        <div>
          <h1 className="text-2xl font-bold">AI 데이터 분석</h1>
          <p className="text-sm text-muted-foreground mt-1">GA4, Odoo 데이터를 실시간으로 조회하여 대화형으로 분석합니다</p>
        </div>

        {/* 채팅 */}
        <AiQueryBox />
      </div>
    </div>
  );
}
