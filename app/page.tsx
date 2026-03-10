import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f6f8]">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold">Booster Internal</h1>
        <div className="flex gap-4">
          <Link href="/kpis" className="rounded-lg bg-[#0177fb] px-6 py-3 text-white font-medium hover:opacity-90">
            KPI 대시보드
          </Link>
          <Link href="/tasks" className="rounded-lg bg-[#171819] px-6 py-3 text-white font-medium hover:opacity-90">
            업무 관리
          </Link>
        </div>
      </div>
    </div>
  );
}
