import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID
const GA4_API = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`

// GA4 인증: 아래 순서로 시도
// 1. GCP_SA_KEY_JSON 환경변수 (서비스 계정 키 JSON)
// 2. Application Default Credentials (gcloud auth application-default login)
async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GCP_SA_KEY_JSON

  const authOptions: ConstructorParameters<typeof GoogleAuth>[0] = {
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    projectId: 'project-150ad5c5-0e90-4383-9bc',
  }

  if (keyJson) {
    authOptions.credentials = JSON.parse(keyJson)
  }
  // keyJson이 없으면 ADC(Application Default Credentials)를 자동으로 사용

  const auth = new GoogleAuth(authOptions)
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to get access token')
  return token
}

async function runReport(accessToken: string, body: object) {
  const res = await fetch(GA4_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': 'project-150ad5c5-0e90-4383-9bc',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

function extractRows(report: { rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[] }) {
  return (report.rows || []).map(row => ({
    dimension: row.dimensionValues?.[0]?.value || '',
    metric: parseInt(row.metricValues?.[0]?.value || '0', 10),
  }))
}

function extractTotals(report: { totals?: { metricValues?: { value: string }[] }[] }) {
  const vals = report.totals?.[0]?.metricValues || []
  return vals.map(v => parseInt(v.value || '0', 10))
}

export async function GET(request: NextRequest) {
  try {
    if (!GA4_PROPERTY_ID) {
      return NextResponse.json({ error: 'GA4_PROPERTY_ID not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '7daysAgo'
    const endDate = searchParams.get('endDate') || 'yesterday'

    const accessToken = await getAccessToken()
    const dateRange = { startDate, endDate }

    const [overviewReport, sourceReport, channelReport, pageReport, dailyReport] = await Promise.all([
      runReport(accessToken, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
        metricAggregations: ['TOTAL'],
      }),
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }],
        dimensionFilter: {
          orGroup: {
            expressions: [
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: 'simulator' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: 'mk-skill-kit' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: 'case-study' } } },
              { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: 'insight' } } },
            ],
          },
        },
      }),
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    ])

    const totals = extractTotals(overviewReport)
    const totalVisitors = totals[0] || 0
    const totalPageViews = totals[1] || 0

    const sessionSources = extractRows(sourceReport).map(r => ({
      source: r.dimension,
      sessions: r.metric,
    }))

    const channelGroups = extractRows(channelReport).map(r => ({
      channel: r.dimension,
      sessions: r.metric,
    }))

    const pageRows = extractRows(pageReport)
    let simulator = 0, ebook = 0, insight = 0
    for (const row of pageRows) {
      const path = row.dimension.toLowerCase()
      if (path.includes('simulator')) simulator += row.metric
      else if (path.includes('mk-skill-kit')) ebook += row.metric
      else if (path.includes('case-study') || path.includes('insight')) insight += row.metric
    }

    const dailyTrend = extractRows(dailyReport).map(r => ({
      date: r.dimension,
      visitors: r.metric,
    }))

    return NextResponse.json({
      totalVisitors,
      totalPageViews,
      sessionSources,
      channelGroups,
      trackPageSessions: { simulator, ebook, insight },
      dailyTrend,
    })
  } catch (error) {
    console.error('GET /api/ga4report error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
