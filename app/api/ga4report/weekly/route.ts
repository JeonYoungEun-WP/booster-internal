import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken, runGA4Report } from '@/src/lib/ga4-server'

// 월-주차 라벨 생성: 해당 월 내 몇 번째 주인지 (월요일 기준)
// ISO 8601: 해당 주의 목요일이 속한 월 기준
function getWeekLabel(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + diffToMon + 3)
  const month = thursday.getMonth() + 1
  const firstOfMonth = new Date(thursday.getFullYear(), thursday.getMonth(), 1)
  const thuDow = firstOfMonth.getDay()
  const offset = thuDow <= 4 ? 4 - thuDow : 11 - thuDow
  const firstThursday = new Date(firstOfMonth)
  firstThursday.setDate(firstOfMonth.getDate() + offset)
  const week = Math.floor((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000)) + 1
  return `${month}-${week}W`
}

// 월요일~일요일 주 경계 생성 (1월 1일이 포함된 월요일부터 시작)
function getWeekBoundaries(year: number): { label: string; start: Date; end: Date }[] {
  const weeks: { label: string; start: Date; end: Date }[] = []
  // 1월 1일이 속한 주의 월요일 찾기 (전년도 12월일 수 있음)
  let d = new Date(year, 0, 1)
  const dayOfWeek = d.getDay()
  // 월요일(1)까지 뒤로 이동: 일(0)→-6, 화(2)→-1, 수(3)→-2, ...
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  d.setDate(d.getDate() + offset)

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  while (d.getFullYear() <= year && d <= today) {
    const start = new Date(d)
    const end = new Date(d)
    end.setDate(end.getDate() + 6)

    // 라벨은 해당 주의 목요일 기준 월로 결정 (ISO 주 방식)
    const thu = new Date(start)
    thu.setDate(thu.getDate() + 3)
    const label = getWeekLabel(thu)
    weeks.push({ label, start: new Date(start), end: new Date(end) })
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID
    if (!propertyId) {
      return NextResponse.json({ error: 'GA4_PROPERTY_ID not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    const accessToken = await getAccessToken()

    // 전년도 12월 말(1월 1일이 속한 주의 월요일)부터 어제까지 일별 데이터 조회
    const jan1 = new Date(year, 0, 1)
    const dow = jan1.getDay()
    const startOffset = dow === 0 ? -6 : 1 - dow
    const weekStart = new Date(year, 0, 1 + startOffset)
    const startDate = formatDate(weekStart)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const endDate = formatDate(yesterday)

    // 일별 총합 + 채널그룹별 데이터를 병렬 조회
    const [report, channelReport] = await Promise.all([
      runGA4Report(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 400,
      }),
      runGA4Report(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'totalUsers' }],
        limit: 5000,
      }),
    ])

    // 일별 데이터를 파싱
    type RowType = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }
    const dailyData: { date: Date; uvs: number; pvs: number }[] = (report.rows || []).map(
      (row: RowType) => {
        const dateStr = row.dimensionValues?.[0]?.value || ''
        const y = parseInt(dateStr.slice(0, 4))
        const m = parseInt(dateStr.slice(4, 6)) - 1
        const d = parseInt(dateStr.slice(6))
        return {
          date: new Date(y, m, d),
          uvs: parseInt(row.metricValues?.[0]?.value || '0', 10),
          pvs: parseInt(row.metricValues?.[1]?.value || '0', 10),
        }
      }
    )

    // 채널그룹별 일별 데이터 파싱
    const PAID_CHANNELS = new Set([
      'Paid Search', 'Paid Social', 'Paid Shopping', 'Paid Video', 'Display', 'Paid Other',
    ])
    const dailyPaid: Record<string, number> = {}
    const dailyChannel: Record<string, Record<string, number>> = {} // dateStr -> { channel: uvs }
    ;(channelReport.rows || []).forEach((row: RowType) => {
      const dateStr = row.dimensionValues?.[0]?.value || ''
      const channel = row.dimensionValues?.[1]?.value || ''
      const uvs = parseInt(row.metricValues?.[0]?.value || '0', 10)
      if (PAID_CHANNELS.has(channel)) {
        dailyPaid[dateStr] = (dailyPaid[dateStr] || 0) + uvs
      }
      if (!dailyChannel[dateStr]) dailyChannel[dateStr] = {}
      dailyChannel[dateStr][channel] = (dailyChannel[dateStr][channel] || 0) + uvs
    })

    // 주 경계 생성 및 집계
    const weekBounds = getWeekBoundaries(year)
    const weeks = weekBounds.map(({ label, start, end }) => {
      let uvs = 0
      let pvs = 0
      let paidUvs = 0
      const channels: Record<string, number> = {}
      for (const d of dailyData) {
        if (d.date >= start && d.date <= end) {
          uvs += d.uvs
          pvs += d.pvs
          const ds = `${d.date.getFullYear()}${String(d.date.getMonth() + 1).padStart(2, '0')}${String(d.date.getDate()).padStart(2, '0')}`
          paidUvs += dailyPaid[ds] || 0
          // 채널별 UV 집계
          const dc = dailyChannel[ds]
          if (dc) {
            for (const [ch, v] of Object.entries(dc)) {
              channels[ch] = (channels[ch] || 0) + v
            }
          }
        }
      }
      return {
        label,
        startDate: formatDate(start),
        endDate: formatDate(end),
        uvs,
        pvs,
        paidUvs,
        organicUvs: uvs - paidUvs,
        channels,
      }
    })

    // 현재 주 & 전주 요약
    const now = new Date()
    let currentWeekIdx = weeks.length - 1
    // 아직 끝나지 않은 주는 마지막, 완료된 주는 그 전
    if (weeks.length >= 2) {
      const lastWeek = weeks[weeks.length - 1]
      const lastEnd = new Date(lastWeek.endDate)
      if (now <= lastEnd) {
        // 현재 주가 아직 진행 중이면 완료된 직전 주를 기준으로
        currentWeekIdx = weeks.length - 2
      }
    }

    const currentWeek = weeks[currentWeekIdx] || null
    const prevWeek = currentWeekIdx > 0 ? weeks[currentWeekIdx - 1] : null

    return NextResponse.json({
      weeks,
      currentWeek,
      prevWeek,
      year,
    })
  } catch (error) {
    console.error('GET /api/ga4report/weekly error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
