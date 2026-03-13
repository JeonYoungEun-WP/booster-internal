import { useState, useEffect } from 'react'

interface UseLeadsOptions {
  limit?: number
  offset?: number
  sortField?: string
  sortDir?: 'asc' | 'desc'
}

export function useLeads({
  limit = 20,
  offset = 0,
  sortField = 'create_date',
  sortDir = 'desc',
}: UseLeadsOptions) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      sortField,
      sortDir,
    })

    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) throw new Error(json.error)
        setData(json.records || [])
        setTotal(json.total || 0)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [limit, offset, sortField, sortDir])

  return { data, total, loading, error, source: 'odoo' as const }
}

export interface MonthData {
  year: number
  month: number
  daysInMonth: number
  counts: Record<number, number>
}

export function useMonthlyLeadCounts() {
  const [months, setMonths] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()

  const prevMonth = curMonth === 0 ? 11 : curMonth - 1
  const prevYear = curMonth === 0 ? curYear - 1 : curYear

  // KST 기준 지난달 1일 ~ 이번달 말일을 UTC로 변환
  const kstStart = new Date(Date.UTC(prevYear, prevMonth, 1) - 9 * 60 * 60 * 1000)
  const kstEnd = new Date(Date.UTC(curYear, curMonth + 1, 1) - 9 * 60 * 60 * 1000)
  const startDate = kstStart.toISOString().replace('T', ' ').slice(0, 19)
  const endDate = kstEnd.toISOString().replace('T', ' ').slice(0, 19)

  useEffect(() => {
    let cancelled = false

    const params = new URLSearchParams({
      action: 'monthly',
      startDate,
      endDate,
    })

    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) throw new Error(json.error)

        const records: { create_date: string }[] = json.records || []
        const curMap: Record<number, number> = {}
        const prevMap: Record<number, number> = {}

        records.forEach((r) => {
          const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z')
          const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
          const m = kst.getUTCMonth()
          const y = kst.getUTCFullYear()
          const day = kst.getUTCDate()

          if (y === curYear && m === curMonth) {
            curMap[day] = (curMap[day] || 0) + 1
          } else if (y === prevYear && m === prevMonth) {
            prevMap[day] = (prevMap[day] || 0) + 1
          }
        })

        setMonths([
          { year: curYear, month: curMonth, daysInMonth: new Date(curYear, curMonth + 1, 0).getDate(), counts: curMap },
          { year: prevYear, month: prevMonth, daysInMonth: new Date(prevYear, prevMonth + 1, 0).getDate(), counts: prevMap },
        ])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [startDate, endDate])

  return { months, loading }
}
