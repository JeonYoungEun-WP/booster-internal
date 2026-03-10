'use client'

import { useState, useEffect } from 'react'
import { fetchGA4Data, type GA4Data } from '@/src/lib/ga4'

export function useGA4Data(period: string, customStart?: string, customEnd?: string) {
  const [data, setData] = useState<GA4Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchGA4Data(period, customStart, customEnd)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '알 수 없는 오류'))
      .finally(() => setLoading(false))
  }, [period, customStart, customEnd])

  return { data, loading, error }
}
