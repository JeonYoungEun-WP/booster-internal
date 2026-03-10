'use client'

import { useState, useEffect } from 'react'

function getDateRange(period: string, customStart?: string, customEnd?: string) {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd }
  }

  switch (period) {
    case '7d': {
      const d = new Date(today); d.setDate(d.getDate() - 7)
      return { startDate: fmt(d), endDate: fmt(today) }
    }
    case '14d': {
      const d = new Date(today); d.setDate(d.getDate() - 14)
      return { startDate: fmt(d), endDate: fmt(today) }
    }
    case '30d': {
      const d = new Date(today); d.setDate(d.getDate() - 30)
      return { startDate: fmt(d), endDate: fmt(today) }
    }
    case '90d': {
      const d = new Date(today); d.setDate(d.getDate() - 90)
      return { startDate: fmt(d), endDate: fmt(today) }
    }
    case 'lastWeek': {
      const lastSunday = new Date(today)
      lastSunday.setDate(today.getDate() - today.getDay())
      const lastMonday = new Date(lastSunday)
      lastMonday.setDate(lastSunday.getDate() - 6)
      return { startDate: fmt(lastMonday), endDate: fmt(lastSunday) }
    }
    case 'all':
      return { startDate: '2020-01-01', endDate: fmt(today) }
    default: {
      const d = new Date(today); d.setDate(d.getDate() - 7)
      return { startDate: fmt(d), endDate: fmt(today) }
    }
  }
}

export function useImwebSignups(period: string, customStart?: string, customEnd?: string) {
  const [signupCount, setSignupCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const { startDate, endDate } = getDateRange(period, customStart, customEnd)
    const params = new URLSearchParams({ startDate, endDate })

    fetch(`/api/imweb?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (!cancelled) setSignupCount(data.signupCount || 0)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [period, customStart, customEnd])

  return { signupCount, loading, error }
}
