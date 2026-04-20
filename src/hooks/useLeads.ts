import { useState, useEffect } from 'react'

interface UseLeadsOptions {
  limit?: number
  offset?: number
  sortField?: string
  sortDir?: 'asc' | 'desc'
  search?: string
}

export function useLeads({
  limit = 20,
  offset = 0,
  sortField = 'create_date',
  sortDir = 'desc',
  search = '',
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
    if (search) params.set('search', search)

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
  }, [limit, offset, sortField, sortDir, search])

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

  // KST 기준 올해 1월 1일 ~ 이번달 말일
  const kstStart = new Date(Date.UTC(curYear, 0, 1) - 9 * 60 * 60 * 1000)
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

        // 월별 맵 초기화 (1월 ~ 현재월)
        const monthMaps: Record<number, Record<number, number>> = {}
        for (let m = 0; m <= curMonth; m++) {
          monthMaps[m] = {}
        }

        records.forEach((r) => {
          const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z')
          const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
          const m = kst.getUTCMonth()
          const y = kst.getUTCFullYear()
          const day = kst.getUTCDate()

          if (y === curYear && monthMaps[m]) {
            monthMaps[m][day] = (monthMaps[m][day] || 0) + 1
          }
        })

        // 현재월이 맨 앞에 오도록 역순 정렬
        const result: MonthData[] = []
        for (let m = curMonth; m >= 0; m--) {
          result.push({
            year: curYear,
            month: m,
            daysInMonth: new Date(curYear, m + 1, 0).getDate(),
            counts: monthMaps[m],
          })
        }
        setMonths(result)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [startDate, endDate])

  return { months, loading, currentMonth: curMonth }
}
