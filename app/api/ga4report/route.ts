import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'
import { getVercelOidcToken } from '@vercel/functions/oidc'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID
const GA4_API = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`

// GA4 인증: 아래 순서로 시도
// 1. GCP_SA_KEY_JSON 환경변수 (서비스 계정 키 JSON)
// 2. Vercel OIDC + GCP Workload Identity Federation (WIF)
// 3. Application Default Credentials (로컬 개발용)
async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GCP_SA_KEY_JSON

  // 1) 서비스 계정 키 JSON이 있으면 직접 사용
  if (keyJson) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const client = await auth.getClient()
    const { token } = await client.getAccessToken()
    if (!token) throw new Error('Failed to get access token')
    return token
  }

  // 2) Vercel OIDC + GCP WIF (보안 정책으로 SA키 발급 불가 시)
  const projectNumber = process.env.GCP_PROJECT_NUMBER
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL

  if (projectNumber && poolId && providerId && serviceAccountEmail && process.env.VERCEL) {
    // Vercel OIDC 토큰 가져오기 (@vercel/functions 사용)
    const oidcToken = await getVercelOidcToken()

    // STS 토큰 교환
    const stsUrl = 'https://sts.googleapis.com/v1/token'
    const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`

    const stsRes = await fetch(stsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        subject_token: oidcToken,
      }),
    })
    if (!stsRes.ok) {
      const errText = await stsRes.text()
      throw new Error(`STS token exchange failed: ${stsRes.status} ${errText.slice(0, 200)}`)
    }
    const stsData = await stsRes.json()

    // 서비스 계정 impersonation으로 GA4 스코프 토큰 획득
    const impersonateUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`
    const impRes = await fetch(impersonateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stsData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: [
          'https://www.googleapis.com/auth/analytics.readonly',
          'https://www.googleapis.com/auth/cloud-platform',
        ],
      }),
    })
    if (!impRes.ok) {
      const errText = await impRes.text()
      throw new Error(`SA impersonation failed: ${impRes.status} ${errText.slice(0, 200)}`)
    }
    const impData = await impRes.json()
    return impData.accessToken
  }

  // 3) ADC (로컬 개발: gcloud auth application-default login)
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    projectId: 'project-150ad5c5-0e90-4383-9bc',
  })
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
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 API ${res.status}: ${text.slice(0, 1000)}`)
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

    const [overviewReport, sourceReport, channelReport, pageReport, dailyReport, eventReport] = await Promise.all([
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
      // Clarity + 전환 이벤트 조회
      runReport(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
        limit: 50,
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

    // 이벤트 데이터 파싱
    type EventRowType = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }
    const events = (eventReport.rows || []).map((row: EventRowType) => ({
      event: row.dimensionValues?.[0]?.value || '',
      count: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
    }))

    // Clarity 이벤트 분리
    const clarityEvents: Record<string, { count: number; users: number }> = {}
    const conversionEvents: Record<string, { count: number; users: number }> = {}
    for (const e of events) {
      if (e.event.startsWith('clarity_')) {
        clarityEvents[e.event] = { count: e.count, users: e.users }
      }
      // 전환 이벤트 (상담신청, 회원가입, 구매 등)
      if (['generate_lead', 'sign_up', 'purchase', 'form_submit', 'consultation_request',
           'contact_form_submit', 'begin_checkout', 'add_to_cart'].includes(e.event)) {
        conversionEvents[e.event] = { count: e.count, users: e.users }
      }
    }

    return NextResponse.json({
      totalVisitors,
      totalPageViews,
      sessionSources,
      channelGroups,
      trackPageSessions: { simulator, ebook, insight },
      dailyTrend,
      events,
      clarityEvents,
      conversionEvents,
    })
  } catch (error) {
    console.error('GET /api/ga4report error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
