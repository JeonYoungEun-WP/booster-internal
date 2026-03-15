import { NextRequest, NextResponse } from 'next/server'
import { generateTrafficAnalysis } from '@/src/lib/ai'
import { getAccessToken, runGA4Report } from '@/src/lib/ga4-server'

// ─── Odoo helpers ────────────────────────────────────────────────────────────

const ODOO_URL = process.env.ODOO_URL || 'https://works.wepick.kr'
const ODOO_DB = process.env.ODOO_DB || 'works'
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

async function odooRpc(service: string, method: string, args: unknown[]) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Date.now(),
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.data?.message || 'Odoo RPC error')
  return data.result
}

async function findOdooParentArticleId(): Promise<number | null> {
  const uid = await odooRpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  if (!uid) return null

  // 리포팅(최상위) > 플랫폼 순서로 탐색
  const reporting = await odooRpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, 'knowledge.article', 'search_read',
    [[['name', '=', '리포팅'], ['parent_id', '=', false]]],
    { fields: ['id', 'name'], limit: 1 },
  ])
  if (!reporting?.length) return null

  const platform = await odooRpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, 'knowledge.article', 'search_read',
    [[['name', '=', '플랫폼'], ['parent_id', '=', reporting[0].id]]],
    { fields: ['id', 'name'], limit: 1 },
  ])
  if (!platform?.length) return null

  return platform[0].id
}

async function createOdooArticle(title: string, htmlBody: string, parentId: number | null) {
  const uid = await odooRpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  if (!uid) throw new Error('Odoo auth failed')

  const vals: Record<string, unknown> = {
    name: title,
    body: htmlBody,
    is_article_visible_by_everyone: true,
    is_article_item: true,
  }
  if (parentId) vals.parent_id = parentId

  const id = await odooRpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, 'knowledge.article', 'create',
    [vals],
  ])
  return id
}

// ─── GA4 weekly data ──────────────────────────────────────────────────────────

function getWeekLabel(date: Date): string {
  const month = date.getMonth() + 1
  const dayOfMonth = date.getDate()
  const week = Math.ceil(dayOfMonth / 7)
  return `${month}-${week}W`
}

function getWeekBoundaries(year: number) {
  const weeks: { label: string; start: Date; end: Date }[] = []
  let d = new Date(year, 0, 1)
  const dayOfWeek = d.getDay()
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  d.setDate(d.getDate() + offset)

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  while (d.getFullYear() <= year && d <= today) {
    const start = new Date(d)
    const end = new Date(d)
    end.setDate(end.getDate() + 6)
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

interface WeekData {
  label: string
  startDate: string
  endDate: string
  uvs: number
  pvs: number
  paidUvs: number
  organicUvs: number
  channels: Record<string, number>
}

async function fetchWeeklyGA4(year: number): Promise<{ weeks: WeekData[]; currentWeek: WeekData | null; prevWeek: WeekData | null }> {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) throw new Error('GA4_PROPERTY_ID not configured')

  const accessToken = await getAccessToken()

  const jan1 = new Date(year, 0, 1)
  const dow = jan1.getDay()
  const startOffset = dow === 0 ? -6 : 1 - dow
  const weekStart = new Date(year, 0, 1 + startOffset)
  const startDate = formatDate(weekStart)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const endDate = formatDate(yesterday)

  type RowType = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }
  const PAID_CHANNELS = new Set(['Paid Search', 'Paid Social', 'Paid Shopping', 'Paid Video', 'Display', 'Paid Other'])

  const [report, channelReport] = await Promise.all([
    runGA4Report(accessToken, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }],
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

  const dailyData = (report.rows || []).map((row: RowType) => {
    const dateStr = row.dimensionValues?.[0]?.value || ''
    return {
      date: new Date(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6))),
      uvs: parseInt(row.metricValues?.[0]?.value || '0', 10),
      pvs: parseInt(row.metricValues?.[1]?.value || '0', 10),
    }
  })

  const dailyPaid: Record<string, number> = {}
  const dailyChannel: Record<string, Record<string, number>> = {}
  ;(channelReport.rows || []).forEach((row: RowType) => {
    const dateStr = row.dimensionValues?.[0]?.value || ''
    const channel = row.dimensionValues?.[1]?.value || ''
    const uvs = parseInt(row.metricValues?.[0]?.value || '0', 10)
    if (PAID_CHANNELS.has(channel)) dailyPaid[dateStr] = (dailyPaid[dateStr] || 0) + uvs
    if (!dailyChannel[dateStr]) dailyChannel[dateStr] = {}
    dailyChannel[dateStr][channel] = (dailyChannel[dateStr][channel] || 0) + uvs
  })

  const weekBounds = getWeekBoundaries(year)
  const weeks: WeekData[] = weekBounds.map(({ label, start, end }) => {
    let uvs = 0, pvs = 0, paidUvs = 0
    const channels: Record<string, number> = {}
    for (const d of dailyData) {
      if (d.date >= start && d.date <= end) {
        uvs += d.uvs
        pvs += d.pvs
        const ds = `${d.date.getFullYear()}${String(d.date.getMonth() + 1).padStart(2, '0')}${String(d.date.getDate()).padStart(2, '0')}`
        paidUvs += dailyPaid[ds] || 0
        const dc = dailyChannel[ds]
        if (dc) {
          for (const [ch, v] of Object.entries(dc)) channels[ch] = (channels[ch] || 0) + v
        }
      }
    }
    return { label, startDate: formatDate(start), endDate: formatDate(end), uvs, pvs, paidUvs, organicUvs: uvs - paidUvs, channels }
  })

  const now = new Date()
  let currentWeekIdx = weeks.length - 1
  if (weeks.length >= 2) {
    const lastEnd = new Date(weeks[weeks.length - 1].endDate)
    if (now <= lastEnd) currentWeekIdx = weeks.length - 2
  }

  return {
    weeks,
    currentWeek: weeks[currentWeekIdx] || null,
    prevWeek: currentWeekIdx > 0 ? weeks[currentWeekIdx - 1] : null,
  }
}

// ─── Leads data ───────────────────────────────────────────────────────────────

interface LeadWeekData { label: string; count: number; paid: number; organic: number }

async function fetchLeadsByWeek(year: number, weekLabels: string[]): Promise<Record<string, LeadWeekData>> {
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3001'

  const res = await fetch(
    `${baseUrl}/api/leads?action=monthly&startDate=${year}-01-01 00:00:00&endDate=${year}-12-31 23:59:59`,
  )
  const data = await res.json()
  const SOURCE_FIELD = 'x_studio_selection_field_8p8_1i3up6bfn'
  const records: Record<string, unknown>[] = data.records || []
  const weekMap: Record<string, { total: number; paid: number; organic: number }> = {}

  records.forEach(r => {
    const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z')
    const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
    const day = kst.getDay()
    const monday = new Date(kst)
    monday.setDate(kst.getDate() - ((day + 6) % 7))
    const label = getWeekLabel(monday)
    if (!weekMap[label]) weekMap[label] = { total: 0, paid: 0, organic: 0 }
    weekMap[label].total += 1
    const src = String(r[SOURCE_FIELD] || '').toLowerCase()
    if (src === 'paid') weekMap[label].paid += 1
    else weekMap[label].organic += 1
  })

  const result: Record<string, LeadWeekData> = {}
  for (const label of weekLabels) {
    result[label] = {
      label,
      count: weekMap[label]?.total || 0,
      paid: weekMap[label]?.paid || 0,
      organic: weekMap[label]?.organic || 0,
    }
  }
  return result
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('ko-KR') }
function wow(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? '+100%' : '0%'
  const pct = ((cur - prev) / prev) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`
}
function wowColor(cur: number, prev: number) {
  const pct = prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100
  if (pct > 0) return 'color:#ef4444'
  if (pct < 0) return 'color:#3b82f6'
  return 'color:#888'
}

const PAID_CHANNEL_SET = new Set(['Paid Search', 'Paid Social', 'Paid Shopping', 'Paid Video', 'Display', 'Paid Other'])

function buildChartUrl(config: object): string {
  const encoded = encodeURIComponent(JSON.stringify(config))
  return `https://quickchart.io/chart?v=3&w=700&h=300&bkg=white&c=${encoded}`
}

function buildUvsChartUrl(weeks: WeekData[], prevYearWeeksMap: Record<string, number>, year: number): string {
  const prevYear = year - 1
  const recent = weeks.slice(-16)
  const config = {
    type: 'bar',
    data: {
      labels: recent.map(w => w.label),
      datasets: [
        {
          label: `${String(prevYear).slice(2)}Y`,
          data: recent.map(w => prevYearWeeksMap[w.label] || 0),
          backgroundColor: '#cbd5e1',
          stack: 'prev',
        },
        {
          label: `${String(year).slice(2)}Y Paid`,
          data: recent.map(w => w.paidUvs),
          backgroundColor: '#0ea5e9',
          stack: 'cur',
        },
        {
          label: `${String(year).slice(2)}Y Organic`,
          data: recent.map(w => w.organicUvs),
          backgroundColor: '#7dd3fc',
          stack: 'cur',
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: '위픽부스터 주간UVs' } },
      scales: { x: { stacked: true }, y: { stacked: false } },
    },
  }
  return buildChartUrl(config)
}

function buildLeadsChartUrl(weeks: WeekData[], leadsMap: Record<string, LeadWeekData>, prevLeadsMap: Record<string, number>, year: number): string {
  const prevYear = year - 1
  const recent = weeks.slice(-16)
  const config = {
    type: 'bar',
    data: {
      labels: recent.map(w => w.label),
      datasets: [
        {
          label: `${String(prevYear).slice(2)}Y`,
          data: recent.map(w => prevLeadsMap[w.label] || 0),
          backgroundColor: '#cbd5e1',
          stack: 'prev',
        },
        {
          label: `${String(year).slice(2)}Y Paid`,
          data: recent.map(w => leadsMap[w.label]?.paid || 0),
          backgroundColor: '#3b82f6',
          stack: 'cur',
        },
        {
          label: `${String(year).slice(2)}Y Organic`,
          data: recent.map(w => leadsMap[w.label]?.organic || 0),
          backgroundColor: '#93c5fd',
          stack: 'cur',
        },
      ],
    },
    options: {
      plugins: { title: { display: true, text: '위픽부스터 문의건수' } },
      scales: { x: { stacked: true }, y: { stacked: false } },
    },
  }
  return buildChartUrl(config)
}

function buildHtml(params: {
  currentWeek: WeekData
  prevWeek: WeekData
  prevYearWeek: WeekData | null
  currentLeads: LeadWeekData
  prevLeads: LeadWeekData
  aiComment: string
  reportTitle: string
  weekDateRange: string
  allWeeks: WeekData[]
  prevYearWeeksMap: Record<string, number>
  allLeadsMap: Record<string, LeadWeekData>
  prevYearLeadsMap: Record<string, number>
  year: number
}): string {
  const { currentWeek, prevWeek, currentLeads, prevLeads, aiComment, reportTitle, weekDateRange, allWeeks, prevYearWeeksMap, allLeadsMap, prevYearLeadsMap, year } = params

  const cvr = currentWeek.uvs > 0 ? (currentLeads.count / currentWeek.uvs * 100).toFixed(2) : '0'
  const prevCvr = prevWeek.uvs > 0 ? (prevLeads.count / prevWeek.uvs * 100).toFixed(2) : '0'

  const allChannels = new Set([...Object.keys(currentWeek.channels), ...Object.keys(prevWeek.channels)])
  const channelRows = Array.from(allChannels)
    .map(ch => ({ ch, cur: currentWeek.channels[ch] || 0, prev: prevWeek.channels[ch] || 0, isPaid: PAID_CHANNEL_SET.has(ch) }))
    .filter(r => r.cur > 0 || r.prev > 0)
    .sort((a, b) => b.cur - a.cur)

  const paidCvr = currentWeek.paidUvs > 0 ? (currentLeads.paid / currentWeek.paidUvs * 100).toFixed(2) : '0.00'
  const prevPaidCvr = prevWeek.paidUvs > 0 ? (prevLeads.paid / prevWeek.paidUvs * 100).toFixed(2) : '0.00'
  const organicCvr = currentWeek.organicUvs > 0 ? (currentLeads.organic / currentWeek.organicUvs * 100).toFixed(2) : '0.00'
  const prevOrganicCvr = prevWeek.organicUvs > 0 ? (prevLeads.organic / prevWeek.organicUvs * 100).toFixed(2) : '0.00'

  const tdStyle = 'padding:8px 12px;border:1px solid #e5e7eb'
  const thStyle = 'padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;text-align:left'

  const uvsChartUrl = buildUvsChartUrl(allWeeks, prevYearWeeksMap, year)
  const leadsChartUrl = buildLeadsChartUrl(allWeeks, allLeadsMap, prevYearLeadsMap, year)

  return `
<h1 style="font-size:20px;font-weight:700;margin-bottom:4px">위픽부스터 ${reportTitle}</h1>
<p style="color:#888;font-size:13px;margin-bottom:24px">${weekDateRange}</p>

<h2 style="font-size:15px;font-weight:600;margin-bottom:12px">📊 AI 주간 트래픽 분석</h2>
<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:24px;font-size:14px;line-height:1.7">
${aiComment.split('\n').filter(l => l.trim()).map(l => `<p style="margin:4px 0">• ${l.replace(/^[•\-\*]\s*/, '')}</p>`).join('')}
</div>

<h2 style="font-size:15px;font-weight:600;margin-bottom:12px">📈 플랫폼 부문_지표</h2>
<p style="font-size:12px;color:#888;margin-bottom:8px">* Paid: Paid Search, Paid Social, Paid Shopping, Paid Video, Display 등 유료 채널 유입 | Organic: Direct, Organic Search, Referral, Email 등 비유료 채널 유입</p>
<img src="${uvsChartUrl}" alt="주간UVs 차트" style="width:100%;max-width:700px;display:block;margin-bottom:8px" />
<p style="font-size:12px;color:#888;margin-bottom:8px">* Paid: Odoo 리드 유입경로가 'paid'인 문의 | Organic: paid 외 전체 문의</p>
<img src="${leadsChartUrl}" alt="문의건수 차트" style="width:100%;max-width:700px;display:block;margin-bottom:24px" />

<h2 style="font-size:15px;font-weight:600;margin-bottom:12px">📋 주간 트래픽 요약</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
  <thead>
    <tr>
      <th style="${thStyle}">지표</th>
      <th style="${thStyle}">${currentWeek.label} (신)위픽부스터</th>
      <th style="${thStyle}">${prevWeek.label} WoW</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">UVs</td>
      <td style="${tdStyle}">${fmt(currentWeek.uvs)}</td>
      <td style="${tdStyle};${wowColor(currentWeek.uvs, prevWeek.uvs)}">${wow(currentWeek.uvs, prevWeek.uvs)}</td>
    </tr>
    <tr>
      <td style="${tdStyle}">PVs</td>
      <td style="${tdStyle}">${fmt(currentWeek.pvs)}</td>
      <td style="${tdStyle};${wowColor(currentWeek.pvs, prevWeek.pvs)}">${wow(currentWeek.pvs, prevWeek.pvs)}</td>
    </tr>
    <tr>
      <td style="${tdStyle}"><strong>리드수-KR</strong></td>
      <td style="${tdStyle}">${fmt(currentLeads.count)}건</td>
      <td style="${tdStyle};${wowColor(currentLeads.count, prevLeads.count)}">${wow(currentLeads.count, prevLeads.count)}</td>
    </tr>
    <tr>
      <td style="${tdStyle}">리드전환율 <span style="color:#6366f1;font-size:11px">관리지표</span></td>
      <td style="${tdStyle}">${currentLeads.count}건 / ${fmt(currentWeek.uvs)} UVs = ${cvr}%</td>
      <td style="${tdStyle};${wowColor(parseFloat(cvr), parseFloat(prevCvr))}">${(parseFloat(cvr) - parseFloat(prevCvr) >= 0 ? '+' : '')}${(parseFloat(cvr) - parseFloat(prevCvr)).toFixed(2)}%p</td>
    </tr>
  </tbody>
</table>

<h2 style="font-size:15px;font-weight:600;margin-bottom:12px">🔍 채널별 유입 성과</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px">
  <thead>
    <tr>
      <th style="${thStyle}">채널</th>
      <th style="${thStyle};text-align:right">UV (${currentWeek.label})</th>
      <th style="${thStyle};text-align:right">UV (${prevWeek.label})</th>
      <th style="${thStyle};text-align:right">WoW</th>
      <th style="${thStyle};text-align:right">리드</th>
      <th style="${thStyle};text-align:right">전환율</th>
    </tr>
  </thead>
  <tbody>
    ${channelRows.map(r => `
    <tr>
      <td style="${tdStyle}">${r.ch}${r.isPaid ? ' <span style="color:#6366f1;font-size:10px">P</span>' : ''}</td>
      <td style="${tdStyle};text-align:right">${fmt(r.cur)}</td>
      <td style="${tdStyle};text-align:right;color:#888">${fmt(r.prev)}</td>
      <td style="${tdStyle};text-align:right;${wowColor(r.cur, r.prev)}">${wow(r.cur, r.prev)}</td>
      <td style="${tdStyle};text-align:right;color:#888">-</td>
      <td style="${tdStyle};text-align:right;color:#888">-</td>
    </tr>`).join('')}
    <tr style="background:#eff6ff">
      <td style="${tdStyle}"><strong style="color:#2563eb">Paid 소계</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${fmt(currentWeek.paidUvs)}</strong></td>
      <td style="${tdStyle};text-align:right;color:#888">${fmt(prevWeek.paidUvs)}</td>
      <td style="${tdStyle};text-align:right;${wowColor(currentWeek.paidUvs, prevWeek.paidUvs)}"><strong>${wow(currentWeek.paidUvs, prevWeek.paidUvs)}</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${currentLeads.paid}건</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${paidCvr}%</strong> <span style="${wowColor(parseFloat(paidCvr), parseFloat(prevPaidCvr))};font-size:11px">(${(parseFloat(paidCvr) - parseFloat(prevPaidCvr) >= 0 ? '+' : '')}${(parseFloat(paidCvr) - parseFloat(prevPaidCvr)).toFixed(2)}%p)</span></td>
    </tr>
    <tr style="background:#f0f9ff">
      <td style="${tdStyle}"><strong style="color:#0369a1">Organic 소계</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${fmt(currentWeek.organicUvs)}</strong></td>
      <td style="${tdStyle};text-align:right;color:#888">${fmt(prevWeek.organicUvs)}</td>
      <td style="${tdStyle};text-align:right;${wowColor(currentWeek.organicUvs, prevWeek.organicUvs)}"><strong>${wow(currentWeek.organicUvs, prevWeek.organicUvs)}</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${currentLeads.organic}건</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${organicCvr}%</strong> <span style="${wowColor(parseFloat(organicCvr), parseFloat(prevOrganicCvr))};font-size:11px">(${(parseFloat(organicCvr) - parseFloat(prevOrganicCvr) >= 0 ? '+' : '')}${(parseFloat(organicCvr) - parseFloat(prevOrganicCvr)).toFixed(2)}%p)</span></td>
    </tr>
    <tr style="background:#f9fafb">
      <td style="${tdStyle}"><strong>전체</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${fmt(currentWeek.uvs)}</strong></td>
      <td style="${tdStyle};text-align:right;color:#888">${fmt(prevWeek.uvs)}</td>
      <td style="${tdStyle};text-align:right;${wowColor(currentWeek.uvs, prevWeek.uvs)}"><strong>${wow(currentWeek.uvs, prevWeek.uvs)}</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${currentLeads.count}건</strong></td>
      <td style="${tdStyle};text-align:right"><strong>${cvr}%</strong> <span style="${wowColor(parseFloat(cvr), parseFloat(prevCvr))};font-size:11px">(${(parseFloat(cvr) - parseFloat(prevCvr) >= 0 ? '+' : '')}${(parseFloat(cvr) - parseFloat(prevCvr)).toFixed(2)}%p)</span></td>
    </tr>
  </tbody>
</table>

<p style="color:#aaa;font-size:11px;margin-top:16px">* 자동 생성: booster-internal 주간 리포트 크론</p>
`.trim()
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Cron secret 검증 (Vercel cron 또는 수동 테스트)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ODOO_USERNAME || !ODOO_API_KEY) {
    return NextResponse.json({ error: 'Odoo not configured' }, { status: 503 })
  }

  try {
    const isTest = request.nextUrl.searchParams.get('test') === 'true'
    const year = new Date().getFullYear()
    const prevYear = year - 1

    // 1. GA4 데이터 조회
    const [gaData, prevYearGaData] = await Promise.all([
      fetchWeeklyGA4(year),
      fetchWeeklyGA4(prevYear).catch(() => null),
    ])

    const { currentWeek, prevWeek } = gaData
    if (!currentWeek || !prevWeek) {
      return NextResponse.json({ error: 'No weekly data available' }, { status: 500 })
    }

    // 2. 리드 데이터 (올해 + 전년도)
    const allLabels = gaData.weeks.map(w => w.label)
    const prevYearLabels = prevYearGaData?.weeks.map(w => w.label) || []
    const [leadsMap, prevYearLeadsMapRaw] = await Promise.all([
      fetchLeadsByWeek(year, allLabels),
      prevYearGaData ? fetchLeadsByWeek(prevYear, prevYearLabels) : Promise.resolve({} as Record<string, LeadWeekData>),
    ])
    const currentLeads = leadsMap[currentWeek.label] || { label: currentWeek.label, count: 0, paid: 0, organic: 0 }
    const prevLeads = leadsMap[prevWeek.label] || { label: prevWeek.label, count: 0, paid: 0, organic: 0 }

    // 전년도 리드 맵 (label → count, 차트용)
    const prevYearLeadsMap: Record<string, number> = {}
    for (const [label, data] of Object.entries(prevYearLeadsMapRaw)) {
      prevYearLeadsMap[label] = data.count
    }

    // 3. 전년도 UVs 맵 (차트용)
    const prevYearWeeksMap: Record<string, number> = {}
    prevYearGaData?.weeks.forEach(w => { prevYearWeeksMap[w.label] = w.uvs })

    // 4. 전년도 동주 데이터
    const prevYearWeek = prevYearGaData?.weeks.find(w => w.label === currentWeek.label) || null

    // 5. AI 분석
    const cvr = currentWeek.uvs > 0 ? parseFloat((currentLeads.count / currentWeek.uvs * 100).toFixed(2)) : 0
    const prevCvr = prevWeek.uvs > 0 ? parseFloat((prevLeads.count / prevWeek.uvs * 100).toFixed(2)) : 0
    const now = new Date()
    const endDate = new Date(currentWeek.endDate + 'T23:59:59')
    const aiComment = await generateTrafficAnalysis({
      currentWeek: {
        label: currentWeek.label,
        uvs: currentWeek.uvs,
        pvs: currentWeek.pvs,
        paidUvs: currentWeek.paidUvs,
        organicUvs: currentWeek.organicUvs,
        channels: currentWeek.channels,
      },
      prevWeek: {
        label: prevWeek.label,
        uvs: prevWeek.uvs,
        pvs: prevWeek.pvs,
        paidUvs: prevWeek.paidUvs,
        organicUvs: prevWeek.organicUvs,
        channels: prevWeek.channels,
      },
      currentLeads: { total: currentLeads.count, paid: currentLeads.paid, organic: currentLeads.organic },
      prevLeads: { total: prevLeads.count, paid: prevLeads.paid, organic: prevLeads.organic },
      yoyUvs: prevYearWeek?.uvs ?? null,
      conversionRate: cvr,
      prevConversionRate: prevCvr,
      isIncomplete: now < endDate,
    }).catch(() => '데이터를 기반으로 AI 분석을 생성할 수 없었습니다.')

    // 6. 제목 결정
    let articleTitle: string
    if (isTest) {
      articleTitle = '트래픽 자동 생성 테스트'
    } else {
      const yy = String(year).slice(2)
      articleTitle = `트래픽 ${yy} ${currentWeek.label}`
    }

    // 7. 날짜 범위 문자열
    const fmt2 = (s: string) => {
      const d = new Date(s + 'T00:00:00')
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    }
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const startD = new Date(currentWeek.startDate + 'T00:00:00')
    const endD = new Date(currentWeek.endDate + 'T00:00:00')
    const weekDateRange = `(${fmt2(currentWeek.startDate)}.${days[startD.getDay()]}~${fmt2(currentWeek.endDate)}.${days[endD.getDay()]})`

    // 8. HTML 빌드
    const htmlBody = buildHtml({
      currentWeek,
      prevWeek,
      prevYearWeek,
      currentLeads,
      prevLeads,
      aiComment,
      reportTitle: isTest ? articleTitle : `KR ${String(year).slice(2)} ${currentWeek.label}`,
      weekDateRange,
      allWeeks: gaData.weeks,
      prevYearWeeksMap,
      allLeadsMap: leadsMap,
      prevYearLeadsMap,
      year,
    })

    // 9. Odoo 부모 아티클 찾기
    const parentId = await findOdooParentArticleId()

    // 10. Odoo Knowledge 아티클 생성
    const articleId = await createOdooArticle(articleTitle, htmlBody, parentId)

    return NextResponse.json({
      success: true,
      articleId,
      title: articleTitle,
      weekLabel: currentWeek.label,
      parentFound: parentId !== null,
    })
  } catch (error) {
    console.error('weekly-report cron error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
