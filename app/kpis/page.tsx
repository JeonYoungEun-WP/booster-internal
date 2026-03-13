'use client';

import { GA4YesterdayBanner } from '@/src/components/kpis/GA4YesterdayBanner';
import { GA4SessionSourceTable } from '@/src/components/kpis/GA4SessionSourceTable';
import { LeadMagnetFunnelTab } from '@/src/components/kpis/LeadMagnetFunnelTab';

export default function KPIsPage() {
  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">GA 리포트</h1>
        <section className="space-y-4">
          <GA4YesterdayBanner />
          <GA4SessionSourceTable />
        </section>
        <LeadMagnetFunnelTab />
      </div>
    </div>
  );
}
