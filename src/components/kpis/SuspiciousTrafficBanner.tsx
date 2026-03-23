'use client'

import { useEffect, useState } from 'react'
import { Globe, ShieldAlert, Bot, Moon, FileSearch, MonitorX } from 'lucide-react'

interface ForeignCountry { country: string; users: number }
interface ProbingPath { path: string; pageviews: number }
interface BotSource { source: string; users: number; avgDuration: number; bounceRate: number }
interface NightTraffic { nightUsers: number; totalUsers: number; ratio: number }
interface MassPage { path: string; pageviews: number }
interface SuspiciousBrowser { browser: string; users: number }
interface NotsetSource { source: string; users: number }

interface SuspiciousData {
  foreignCountries: ForeignCountry[]
  probingPaths: ProbingPath[]
  botSources: BotSource[]
  nightTraffic: NightTraffic | null
  massPages: MassPage[]
  suspiciousBrowsers: SuspiciousBrowser[]
  notsetSources: NotsetSource[]
  date: string
  hasSuspicious: boolean
}

export function SuspiciousTrafficBanner() {
  const [data, setData] = useState<SuspiciousData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ga4report/suspicious')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 animate-pulse">
        <div className="h-4 w-48 bg-orange-200/50 rounded" />
      </div>
    )
  }

  if (!data || !data.hasSuspicious) return null

  const totalAlerts =
    data.foreignCountries.length +
    data.probingPaths.length +
    data.botSources.length +
    data.massPages.length +
    data.suspiciousBrowsers.length +
    data.notsetSources.length

  return (
    <div className="rounded-xl border border-orange-300 bg-orange-50/80 p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-orange-600" />
        <h3 className="text-sm font-bold text-orange-800">
          이상 트래픽 감지 ({data.date})
        </h3>
        <span className="ml-auto rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-800">
          {totalAlerts}건
        </span>
      </div>

      {/* 1. 해외 이상 트래픽 */}
      {data.foreignCountries.length > 0 && (
        <Section
          icon={<Globe className="h-4 w-4 text-amber-600" />}
          title={`해외 이상 트래픽 (30+ UVs) — ${data.foreignCountries.length}개국`}
        >
          <div className="flex flex-wrap gap-2">
            {data.foreignCountries.map((c) => (
              <span
                key={c.country}
                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
              >
                {c.country} <span className="font-bold">{c.users}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 2. 워드프레스 프로빙 */}
      {data.probingPaths.length > 0 && (
        <Section
          icon={<ShieldAlert className="h-4 w-4 text-red-600" />}
          title={`워드프레스/보안 프로빙 — ${data.probingPaths.length}건`}
        >
          <div className="space-y-1">
            {data.probingPaths.map((p) => (
              <div key={p.path} className="flex items-center justify-between rounded bg-red-100/60 px-2 py-1 text-xs">
                <code className="text-red-700 truncate max-w-[300px]">{p.path}</code>
                <span className="font-medium text-red-800 ml-2">{p.pageviews} PVs</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 3. 봇 의심 소스 */}
      {data.botSources.length > 0 && (
        <Section
          icon={<Bot className="h-4 w-4 text-orange-600" />}
          title={`봇 의심 소스 — ${data.botSources.length}건`}
        >
          <div className="space-y-1">
            {data.botSources.map((s) => (
              <div key={s.source} className="flex items-center justify-between rounded bg-orange-100/60 px-2 py-1 text-xs">
                <span className="font-medium text-orange-800 truncate max-w-[200px]">{s.source}</span>
                <span className="text-orange-700 ml-2 whitespace-nowrap">
                  {s.users}명 | {s.avgDuration.toFixed(1)}초 | 이탈{(s.bounceRate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 4. 새벽 시간대 집중 */}
      {data.nightTraffic && (
        <Section
          icon={<Moon className="h-4 w-4 text-indigo-600" />}
          title="새벽 시간대 집중 (KST 0~5시)"
        >
          <div className="rounded bg-indigo-100/60 px-2 py-1.5 text-xs text-indigo-800">
            새벽 {data.nightTraffic.nightUsers}명 / 전체 {data.nightTraffic.totalUsers}명
            = <span className="font-bold">{(data.nightTraffic.ratio * 100).toFixed(0)}%</span>
            <span className="ml-1 text-indigo-600">(참고 지표 — 단독으로 봇 판정하지 않음)</span>
          </div>
        </Section>
      )}

      {/* 5. 단일 페이지 대량 PV */}
      {data.massPages.length > 0 && (
        <Section
          icon={<FileSearch className="h-4 w-4 text-rose-600" />}
          title={`단일 페이지 대량 PV (100+) — ${data.massPages.length}건`}
        >
          <div className="space-y-1">
            {data.massPages.map((p) => (
              <div key={p.path} className="flex items-center justify-between rounded bg-rose-100/60 px-2 py-1 text-xs">
                <code className="text-rose-700 truncate max-w-[300px]">{p.path}</code>
                <span className="font-bold text-rose-800 ml-2">{p.pageviews} PVs</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 6. 헤드리스 봇 (브라우저 not set) */}
      {data.suspiciousBrowsers.length > 0 && (
        <Section
          icon={<MonitorX className="h-4 w-4 text-red-600" />}
          title={`헤드리스 봇 (브라우저 미식별) — ${data.suspiciousBrowsers.length}건`}
        >
          <div className="flex flex-wrap gap-2">
            {data.suspiciousBrowsers.map((b) => (
              <span key={b.browser} className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                {b.browser || '(not set)'} <span className="font-bold">{b.users}명</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 7. (not set) 소스 대량 유입 */}
      {data.notsetSources.length > 0 && (
        <Section
          icon={<Bot className="h-4 w-4 text-gray-600" />}
          title={`미식별 소스 대량 유입 (20+) — ${data.notsetSources.length}건`}
        >
          <div className="flex flex-wrap gap-2">
            {data.notsetSources.map((s) => (
              <span key={s.source} className="inline-flex items-center gap-1 rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700">
                {s.source || '(not set)'} <span className="font-bold">{s.users}명</span>
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  )
}
