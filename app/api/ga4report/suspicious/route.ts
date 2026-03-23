import { NextResponse } from 'next/server'
import { getAccessToken, runGA4Report } from '@/src/lib/ga4-server'

// WordPress/보안 프로빙 패턴
const PROBING_PATTERNS = [
  'wp-login', 'wp-admin', 'xmlrpc', 'wp-includes', 'wp-content',
  'wp-json', 'phpmyadmin', '.env', '.git', '/admin',
]

// 봇 탐지 임계값
const BOT_MIN_USERS = 10
const BOT_MAX_AVG_DURATION = 5 // 초
const BOT_MIN_BOUNCE_RATE = 0.9 // 90%

// 해외 트래픽 임계값
const FOREIGN_MIN_USERS = 30

type RowType = {
  dimensionValues?: { value: string }[]
  metricValues?: { value: string }[]
}

export async function GET() {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      return NextResponse.json({ error: 'GA4_PROPERTY_ID not configured' }, { status: 503 })
    }

    const accessToken = await getAccessToken()
    const dateRange = { startDate: 'yesterday', endDate: 'yesterday' }

    const [countryReport, pathReport, sourceReport] = await Promise.all([
      // 1. 국가별 사용자
      runGA4Report(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 50,
      }),
      // 2. 워드프레스/보안 프로빙 경로
      runGA4Report(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          orGroup: {
            expressions: PROBING_PATTERNS.map((p) => ({
              filter: {
                fieldName: 'pagePath',
                stringFilter: { matchType: 'CONTAINS', value: p },
              },
            })),
          },
        },
        limit: 50,
      }),
      // 3. 소스별 세션 품질 (봇 탐지)
      runGA4Report(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 50,
      }),
    ])

    // 1. 해외 이상 트래픽 (한국 제외, 30+ UVs)
    const foreignCountries = (countryReport.rows || [])
      .map((r: RowType) => ({
        country: r.dimensionValues?.[0]?.value || '',
        users: parseInt(r.metricValues?.[0]?.value || '0', 10),
      }))
      .filter(
        (r: { country: string; users: number }) =>
          r.country !== 'South Korea' && r.country !== '(not set)' && r.users >= FOREIGN_MIN_USERS,
      )

    // 2. 워드프레스 프로빙 경로
    const probingPaths = (pathReport.rows || [])
      .map((r: RowType) => ({
        path: r.dimensionValues?.[0]?.value || '',
        pageviews: parseInt(r.metricValues?.[0]?.value || '0', 10),
      }))
      .filter((r: { pageviews: number }) => r.pageviews >= 1)

    // 3. 봇 의심 소스 (짧은 체류 + 높은 이탈률 + 일정 규모)
    const botSources = (sourceReport.rows || [])
      .map((r: RowType) => ({
        source: r.dimensionValues?.[0]?.value || '',
        users: parseInt(r.metricValues?.[0]?.value || '0', 10),
        avgDuration: parseFloat(r.metricValues?.[1]?.value || '0'),
        bounceRate: parseFloat(r.metricValues?.[2]?.value || '0'),
      }))
      .filter(
        (r: { users: number; avgDuration: number; bounceRate: number }) =>
          r.users >= BOT_MIN_USERS &&
          r.avgDuration < BOT_MAX_AVG_DURATION &&
          r.bounceRate > BOT_MIN_BOUNCE_RATE,
      )

    // 어제 날짜 계산
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const date = y.toISOString().slice(0, 10)

    const hasSuspicious =
      foreignCountries.length > 0 || probingPaths.length > 0 || botSources.length > 0

    return NextResponse.json({
      foreignCountries,
      probingPaths,
      botSources,
      date,
      hasSuspicious,
    })
  } catch (error) {
    console.error('GET /api/ga4report/suspicious error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
