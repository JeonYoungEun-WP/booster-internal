'use client';

import Link from 'next/link';
import { GA4YesterdayBanner } from '@/src/components/kpis/GA4YesterdayBanner';
import { SuspiciousTrafficBanner } from '@/src/components/kpis/SuspiciousTrafficBanner';
import { GA4SessionSourceTable } from '@/src/components/kpis/GA4SessionSourceTable';
import { LeadMagnetFunnelTab } from '@/src/components/kpis/LeadMagnetFunnelTab';

export default function KPIsPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">GA 리포트</h1>
          <Link
            href="/kpis/weekly-report"
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
          >
            주간 리포트
          </Link>
        </div>
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
