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
      return {}
    default: {
      const d = new Date(today); d.setDate(d.getDate() - 7)
      return { startDate: fmt(d), endDate: fmt(today) }
    }
  }
}

export function useLeadFunnel(period: string, customStart?: string, customEnd?: string) {
  const [inquiryCount, setInquiryCount] = useState(0)
  const [nurturingCount, setNurturingCount] = useState(0)
  const [consultationCount, setConsultationCount] = useState(0)
  const [stages, setStages] = useState<{ name: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const range = getDateRange(period, customStart, customEnd)
    const params = new URLSearchParams({ action: 'lead-funnel' })
    if (range.startDate) params.set('startDate', range.startDate)
    if (range.endDate) params.set('endDate', range.endDate)

    fetch(`/api/odoo?${params}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setInquiryCount(data.inquiryCount || 0)
        setNurturingCount(data.nurturingCount || 0)
        setConsultationCount(data.consultationCount || 0)
        setStages((data.stages || []).map((s: { name: string; count: number }) => ({
          name: s.name,
          count: s.count,
        })))
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [period, customStart, customEnd])

  return { inquiryCount, nurturingCount, consultationCount, stages, loading, error }
}
