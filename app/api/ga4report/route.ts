import { NextRequest, NextResponse } from 'next/server'
import { ExternalAccountClient } from 'google-auth-library'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER
const GCP_SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT_EMAIL
const GCP_POOL_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID
const GCP_PROVIDER_ID = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID

const GA4_API = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`

async function getAccessToken(): Promise<string> {
  // Vercel OIDC를 통한 Workload Identity Federation
  const { getVercelOidcToken } = await import('@vercel/oidc')

  const client = ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_POOL_ID}/providers/${GCP_PROVIDER_ID}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: async () => getVercelOidcToken(),
    },
  })

  if (!client) throw new Error('Failed to create auth client')

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
    if (!GA4_PROPERTY_ID || !GCP_PROJECT_NUMBER) {
      return NextResponse.json({ error: 'GA4 not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || '7daysAgo'
    const endDate = searchParams.get('endDate') || 'yesterday'

    const accessToken = await getAccessToken()
    const dateRange = { startDate, endDate }

    // 병렬 요청: 방문자+PV, 세션소스, 채널그룹, 트랙별 페이지, 일별 추이
    const [overviewReport, sourceReport, channelReport, pageReport, dailyReport] = await Promise.all([
      // 1. 전체 방문자 + 페이지뷰
      runReport(accessToken, {
        dateRanges: [dateRange],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
      }),
      // 2. 세션 소스 TOP 10
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      // 3. 채널 그룹 TOP 10
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
      // 4. 트랙별 페이지 세션 (simulator, ebook, insight)
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
      // 5. 일별 방문자 추이
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
    ])

    // 파싱
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

    // 트랙별 세션 집계
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
