export interface GA4Data {
  sessionSources: { source: string; sessions: number }[]
  channelGroups: { channel: string; sessions: number }[]
  totalVisitors: number
  totalPageViews: number
  trackPageSessions: { simulator: number; ebook: number; insight: number }
  dailyTrend: { date: string; visitors: number }[]
}

function getDateRange(type: string, customStart?: string, customEnd?: string) {
  if (type === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd }
  }

  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  switch (type) {
    case '7d':
      return { startDate: '7daysAgo', endDate: 'yesterday' }
    case '14d':
      return { startDate: '14daysAgo', endDate: 'yesterday' }
    case '30d':
      return { startDate: '30daysAgo', endDate: 'yesterday' }
    case '90d':
      return { startDate: '90daysAgo', endDate: 'yesterday' }
    case 'lastWeek': {
      const lastSunday = new Date(today)
      lastSunday.setDate(today.getDate() - today.getDay())
      const lastMonday = new Date(lastSunday)
      lastMonday.setDate(lastSunday.getDate() - 6)
      return { startDate: fmt(lastMonday), endDate: fmt(lastSunday) }
    }
    case 'all':
      return { startDate: '2020-01-01', endDate: 'yesterday' }
    default:
      return { startDate: '7daysAgo', endDate: 'yesterday' }
  }
}

const EMPTY: GA4Data = {
  sessionSources: [],
  channelGroups: [],
  totalVisitors: 0,
  totalPageViews: 0,
  trackPageSessions: { simulator: 0, ebook: 0, insight: 0 },
  dailyTrend: [],
}

export async function fetchGA4Data(
  type: string,
  customStart?: string,
  customEnd?: string,
): Promise<GA4Data> {
  try {
    const { startDate, endDate } = getDateRange(type, customStart, customEnd)
    const params = new URLSearchParams({ startDate, endDate })
    const res = await fetch(`/api/ga4report?${params}`)

    if (!res.ok) {
      console.warn('GA4 API error:', res.status)
      return EMPTY
    }

    return await res.json()
  } catch (err) {
    console.warn('GA4 fetch failed:', err)
    return EMPTY
  }
}
