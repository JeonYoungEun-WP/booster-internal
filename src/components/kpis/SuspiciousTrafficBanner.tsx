'use client'

import { useEffect, useState } from 'react'
import { Globe, ShieldAlert, Bot } from 'lucide-react'

interface ForeignCountry {
  country: string
  users: number
}
interface ProbingPath {
  path: string
  pageviews: number
}
interface BotSource {
  source: string
  users: number
  avgDuration: number
  bounceRate: number
}
interface SuspiciousData {
  foreignCountries: ForeignCountry[]
  probingPaths: ProbingPath[]
  botSources: BotSource[]
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
    data.foreignCountries.length + data.probingPaths.length + data.botSources.length

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

      {data.foreignCountries.length > 0 && (
        <Section
          icon={<Globe className="h-4 w-4 text-amber-600" />}
          title={`해외 이상 트래픽 (30+ UVs) — ${data.foreignCountries.length}개국`}
          color="amber"
        >
          <div className="flex flex-wrap gap-2">
            {data.foreignCountries.map((c) => (
              <span
                key={c.country}
                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"
              >
                {c.country}
                <span className="font-bold">{c.users}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {data.probingPaths.length > 0 && (
        <Section
          icon={<ShieldAlert className="h-4 w-4 text-red-600" />}
          title={`워드프레스/보안 프로빙 — ${data.probingPaths.length}건`}
          color="red"
        >
          <div className="space-y-1">
            {data.probingPaths.map((p) => (
              <div
                key={p.path}
                className="flex items-center justify-between rounded bg-red-100/60 px-2 py-1 text-xs"
              >
                <code className="text-red-700 truncate max-w-[300px]">{p.path}</code>
                <span className="font-medium text-red-800 ml-2">{p.pageviews} PVs</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.botSources.length > 0 && (
        <Section
          icon={<Bot className="h-4 w-4 text-orange-600" />}
          title={`봇 의심 소스 — ${data.botSources.length}건`}
          color="orange"
        >
          <div className="space-y-1">
            {data.botSources.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between rounded bg-orange-100/60 px-2 py-1 text-xs"
              >
                <span className="font-medium text-orange-800 truncate max-w-[200px]">
                  {s.source}
                </span>
                <span className="text-orange-700 ml-2 whitespace-nowrap">
                  {s.users}명 | {s.avgDuration.toFixed(1)}초 | 이탈{(s.bounceRate * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
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
