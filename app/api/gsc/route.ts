import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/src/lib/ga4-server'

const SITE_URL = 'sc-domain:booster.im'
const GSC_API = 'https://searchconsole.googleapis.com/webmasters/v3'

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/**
 * GET /api/gsc?type=query|page|date&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&limit=10
 * Google Search Console 검색 성과 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'query' // query, page, date
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // 기본 날짜: 최근 7일 (GSC는 2~3일 지연)
    const now = new Date()
    const defaultEnd = new Date(now)
    defaultEnd.setDate(now.getDate() - 3)
    const defaultStart = new Date(defaultEnd)
    defaultStart.setDate(defaultEnd.getDate() - 6)

    const startDate = searchParams.get('startDate') || defaultStart.toISOString().slice(0, 10)
    const endDate = searchParams.get('endDate') || defaultEnd.toISOString().slice(0, 10)

    const accessToken = await getAccessToken()

    const dimensions: string[] = []
    if (type === 'query') dimensions.push('query')
    else if (type === 'page') dimensions.push('page')
    else if (type === 'date') dimensions.push('date')
    else if (type === 'query-page') {
      dimensions.push('query', 'page')
    }

    const body = {
      startDate,
      endDate,
      dimensions,
      rowLimit: limit,
      dataState: 'all',
    }

    const res = await fetch(
      `${GSC_API}/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('GSC API error:', res.status, errText.slice(0, 500))
      return NextResponse.json({ error: `GSC API ${res.status}: ${errText.slice(0, 200)}` }, { status: res.status })
    }

    const data = await res.json()
    const rows: GscRow[] = data.rows || []

    const result = rows.map(row => ({
      keys: row.keys,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 10000) / 100, // % 변환
      position: Math.round(row.position * 10) / 10,
    }))

    return NextResponse.json({
      startDate,
      endDate,
      type,
      rows: result,
      totalRows: result.length,
    })
  } catch (error) {
    console.error('GET /api/gsc error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
