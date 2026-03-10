'use client'

import { useState, useEffect, useCallback } from 'react'

interface WeeklyReport {
  id: string
  weekStart: string
  authorEmail: string
  authorName: string
  weeklyPlan: string | null
  weeklySummary: string | null
  summaryGeneratedAt: string | null
}

export function useWeeklyReports(authorEmail?: string) {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (authorEmail) params.set('authorEmail', authorEmail)
      const res = await fetch(`/api/tasks/weekly?${params}`)
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json()
      setReports(data.reports || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [authorEmail])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const savePlan = useCallback(async (weekStart: string, email: string, weeklyPlan: string) => {
    const res = await fetch('/api/tasks/weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart, authorEmail: email, weeklyPlan }),
    })
    if (!res.ok) throw new Error('저장 실패')
    await fetchReports()
  }, [fetchReports])

  const generateSummary = useCallback(async () => {
    const res = await fetch('/api/tasks/weekly/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error('생성 실패')
    await fetchReports()
  }, [fetchReports])

  return { reports, loading, error, savePlan, generateSummary }
}
