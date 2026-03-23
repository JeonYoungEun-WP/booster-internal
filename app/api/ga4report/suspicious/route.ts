import { NextResponse } from 'next/server'
import { getAccessToken, runGA4Report } from '@/src/lib/ga4-server'

// WordPress/보안 프로빙 패턴
const PROBING_PATTERNS = [
  'wp-login', 'wp-admin', 'xmlrpc', 'wp-includes', 'wp-content',
  'wp-json', 'phpmyadmin', '.env', '.git', '/admin',
]

// 임계값
const FOREIGN_MIN_USERS = 30
const BOT_MIN_USERS = 10
const BOT_MAX_AVG_DURATION = 5
const BOT_MIN_BOUNCE_RATE = 0.9
const NIGHT_TRAFFIC_RATIO = 0.3    // 새벽 트래픽 30%+ 이면 의심
const PAGE_MASS_PV = 100            // 단일 페이지 100+ PV
const NOTSET_BROWSER_MIN = 10       // (not set) 브라우저 10+ 유저
const NOTSET_SOURCE_MIN = 20        // (not set) 소스 20+ 유저

type RowType = {
  dimensionValues?: { value: string }[]
  metricValues?: { value: string }[]
}

export async function GET(request: Request) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      return NextResponse.json({ error: 'GA4_PROPERTY_ID not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const startDate = dateParam || 'yesterday'
    const endDate = dateParam || 'yesterday'

    const accessToken = await getAccessToken()
    const dateRange = { startDate, endDate }

    const [
      countryReport, pathReport, sourceReport,
      hourReport, pagePvReport, browserReport,
    ] = await Promise.all([
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
      // 4. 시간대별 사용자 (새벽 집중 탐지, GA4 hour는 UTC 기준)
      runGA4Report(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'hour' }],
        metrics: [{ name: 'totalUsers' }],
        limit: 24,
      }),
      // 5. 페이지별 PV (단일 페이지 대량 PV)
      runGA4Report(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
      }),
      // 6. 브라우저별 사용자 (헤드리스 봇 탐지)
      runGA4Report(accessToken, {
        dateRanges: [dateRange],
        dimensions: [{ name: 'browser' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 30,
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

    // 4. 새벽 시간대 집중 (KST 0~5시 = UTC 15~20시)
    const hourRows = (hourReport.rows || []).map((r: RowType) => ({
      hour: parseInt(r.dimensionValues?.[0]?.value || '0', 10),
      users: parseInt(r.metricValues?.[0]?.value || '0', 10),
    }))
    const totalHourUsers = hourRows.reduce((s: number, r: { users: number }) => s + r.users, 0)
    // KST 0~5시 = UTC 15~20시
    const nightUsers = hourRows
      .filter((r: { hour: number }) => r.hour >= 15 && r.hour <= 20)
      .reduce((s: number, r: { users: number }) => s + r.users, 0)
    const nightRatio = totalHourUsers > 0 ? nightUsers / totalHourUsers : 0
    const nightTraffic = nightRatio >= NIGHT_TRAFFIC_RATIO && nightUsers >= 10
      ? { nightUsers, totalUsers: totalHourUsers, ratio: nightRatio }
      : null

    // 5. 단일 페이지 대량 PV (100+ PV)
    const massPages = (pagePvReport.rows || [])
      .map((r: RowType) => ({
        path: r.dimensionValues?.[0]?.value || '',
        pageviews: parseInt(r.metricValues?.[0]?.value || '0', 10),
      }))
      .filter((r: { path: string; pageviews: number }) => {
        // 메인 페이지, 일반적 인기 페이지는 제외
        const normalPaths = ['/', '/simulator', '/mk-skill-kit', '/case-study', '/insight']
        return r.pageviews >= PAGE_MASS_PV && !normalPaths.includes(r.path)
      })

    // 6. (not set) 브라우저 = 헤드리스 봇
    const suspiciousBrowsers = (browserReport.rows || [])
      .map((r: RowType) => ({
        browser: r.dimensionValues?.[0]?.value || '',
        users: parseInt(r.metricValues?.[0]?.value || '0', 10),
      }))
      .filter(
        (r: { browser: string; users: number }) =>
          (r.browser === '(not set)' || r.browser === '') && r.users >= NOTSET_BROWSER_MIN,
      )

    // 7. (not set) 소스 대량 유입 (3번과 별도: 소스 자체가 미식별)
    const notsetSources = (sourceReport.rows || [])
      .map((r: RowType) => ({
        source: r.dimensionValues?.[0]?.value || '',
        users: parseInt(r.metricValues?.[0]?.value || '0', 10),
      }))
      .filter(
        (r: { source: string; users: number }) =>
          (r.source === '(not set)' || r.source === '') && r.users >= NOTSET_SOURCE_MIN,
      )

    // 조회 날짜
    let date: string
    if (dateParam) {
      date = dateParam
    } else {
      const y = new Date()
      y.setDate(y.getDate() - 1)
      date = y.toISOString().slice(0, 10)
    }

    const hasSuspicious =
      foreignCountries.length > 0 ||
      probingPaths.length > 0 ||
      botSources.length > 0 ||
      nightTraffic !== null ||
      massPages.length > 0 ||
      suspiciousBrowsers.length > 0 ||
      notsetSources.length > 0

    return NextResponse.json({
      foreignCountries,
      probingPaths,
      botSources,
      nightTraffic,
      massPages,
      suspiciousBrowsers,
      notsetSources,
      date,
      hasSuspicious,
    })
  } catch (error) {
    console.error('GET /api/ga4report/suspicious error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
