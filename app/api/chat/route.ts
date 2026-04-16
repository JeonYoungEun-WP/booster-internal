import { streamText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { getAccessToken, runGA4Report } from '@/src/lib/ga4-server'

export const maxDuration = 120

// Odoo config
const ODOO_URL = process.env.ODOO_URL || 'https://works.wepick.kr'
const ODOO_DB = process.env.ODOO_DB || 'works'
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

async function odooRpc(service: string, method: string, args: unknown[]) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: Date.now() }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.data?.message || 'Odoo RPC error')
  return data.result
}

// Tool parameter schemas
const ga4Schema = z.object({
  startDate: z.string().describe('시작일 (YYYY-MM-DD 또는 7daysAgo, 30daysAgo, yesterday)'),
  endDate: z.string().describe('종료일 (YYYY-MM-DD 또는 yesterday)'),
})

const ga4ReportSchema = z.object({
  startDate: z.string().describe('시작일'),
  endDate: z.string().describe('종료일'),
  dimensions: z.array(z.string()).describe('GA4 dimension 이름 배열 (예: country, pagePath, eventName)'),
  metrics: z.array(z.string()).describe('GA4 metric 이름 배열 (예: totalUsers, sessions, bounceRate)'),
  limit: z.number().optional().describe('결과 수 제한 (기본 20)'),
})

const leadsSchema = z.object({
  startDate: z.string().describe('시작일 (YYYY-MM-DD)'),
  endDate: z.string().describe('종료일 (YYYY-MM-DD)'),
})

const chartSchema = z.object({
  title: z.string().describe('차트 제목'),
  type: z.enum(['bar', 'line', 'pie']).describe('차트 타입'),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    value2: z.number().optional(),
  })).describe('차트 데이터 배열'),
  valueLabel: z.string().optional().describe('값 레이블'),
  value2Label: z.string().optional().describe('두번째 값 레이블'),
})

type GA4Params = z.infer<typeof ga4Schema>
type GA4ReportParams = z.infer<typeof ga4ReportSchema>
type LeadsParams = z.infer<typeof leadsSchema>
type RowType = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }

// GA4 기본 데이터 조회 (직접 API 호출)
async function executeGA4(params: GA4Params) {
  const accessToken = await getAccessToken()
  const dateRange = { startDate: params.startDate, endDate: params.endDate }

  const [overviewReport, channelReport, sourceReport, dailyReport, eventReport] = await Promise.all([
    runGA4Report(accessToken, {
      dateRanges: [dateRange],
      metrics: [{ name: 'totalUsers' }, { name: 'screenPageViews' }],
      metricAggregations: ['TOTAL'],
    }),
    runGA4Report(accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),
    runGA4Report(accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    }),
    runGA4Report(accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'totalUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    runGA4Report(accessToken, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
      limit: 30,
    }),
  ])

  const totals = overviewReport.totals?.[0]?.metricValues || []
  const channels = (channelReport.rows || []).map((r: RowType) => ({
    channel: r.dimensionValues?.[0]?.value, sessions: parseInt(r.metricValues?.[0]?.value || '0'),
  }))
  const sources = (sourceReport.rows || []).map((r: RowType) => ({
    source: r.dimensionValues?.[0]?.value, sessions: parseInt(r.metricValues?.[0]?.value || '0'),
  }))
  const daily = (dailyReport.rows || []).map((r: RowType) => ({
    date: r.dimensionValues?.[0]?.value, visitors: parseInt(r.metricValues?.[0]?.value || '0'),
  }))
  const events = (eventReport.rows || []).map((r: RowType) => ({
    event: r.dimensionValues?.[0]?.value,
    count: parseInt(r.metricValues?.[0]?.value || '0'),
    users: parseInt(r.metricValues?.[1]?.value || '0'),
  }))

  return {
    totalVisitors: parseInt(totals[0]?.value || '0'),
    totalPageViews: parseInt(totals[1]?.value || '0'),
    channelGroups: channels,
    sessionSources: sources,
    dailyTrend: daily,
    events,
  }
}

// GA4 커스텀 리포트
async function executeGA4Report(params: GA4ReportParams) {
  try {
    const accessToken = await getAccessToken()
    const report = await runGA4Report(accessToken, {
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: params.dimensions.map((n: string) => ({ name: n })),
      metrics: params.metrics.map((n: string) => ({ name: n })),
      orderBys: [{ metric: { metricName: params.metrics[0] }, desc: true }],
      limit: params.limit || 20,
    })
    const rows = (report.rows || []).map((row: RowType) => ({
      dimensions: row.dimensionValues?.map(d => d.value) || [],
      metrics: row.metricValues?.map(m => m.value) || [],
    }))
    return { rows, dimensionHeaders: params.dimensions, metricHeaders: params.metrics }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

// 상대 날짜를 실제 날짜로 변환
function resolveDate(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  const now = new Date()
  if (d === 'yesterday') { now.setDate(now.getDate() - 1); return now.toISOString().slice(0, 10) }
  if (d === 'today') return now.toISOString().slice(0, 10)
  const m = d.match(/^(\d+)daysAgo$/)
  if (m) { now.setDate(now.getDate() - parseInt(m[1])); return now.toISOString().slice(0, 10) }
  return d
}

// Odoo 리드 조회 (직접 RPC 호출)
async function executeLeads(params: LeadsParams) {
  if (!ODOO_USERNAME || !ODOO_API_KEY) return { total: 0, paid: 0, organic: 0, error: 'Odoo not configured' }
  try {
    const uid = await odooRpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
    if (!uid) return { total: 0, paid: 0, organic: 0, error: 'Auth failed' }

    const domain: unknown[] = []
    const start = resolveDate(params.startDate)
    const end = resolveDate(params.endDate)
    if (start) domain.push(['create_date', '>=', start])
    if (end) domain.push(['create_date', '<=', end + ' 23:59:59'])

    const records = await odooRpc('object', 'execute_kw', [
      ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'search_read',
      [domain],
      { fields: ['create_date', 'x_studio_selection_field_8p8_1i3up6bfn'], limit: 500 },
    ]) as Record<string, unknown>[]

    const paid = records.filter(r => String(r.x_studio_selection_field_8p8_1i3up6bfn || '').toLowerCase() === 'paid').length
    return { total: records.length, paid, organic: records.length - paid }
  } catch (err) {
    return { total: 0, paid: 0, organic: 0, error: (err as Error).message }
  }
}

export async function POST(req: Request) {
  const body = await req.json()

  // useChat은 parts 형식으로 보내므로 content 형식으로 변환
  const messages = (body.messages || []).map((msg: Record<string, unknown>) => {
    if (msg.content) return msg
    // parts 형식 → content 형식
    const parts = msg.parts as Array<{ type: string; text?: string }> | undefined
    const text = parts?.filter(p => p.type === 'text').map(p => p.text).join('') || ''
    return { role: msg.role, content: text }
  })

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: `당신은 위픽부스터(B2B 마케팅 SaaS, booster.im)의 데이터 분석가입니다.

중요: 사용자가 질문하면 절대 되묻지 마세요. 바로 도구를 호출하여 데이터를 가져온 뒤 분석 결과를 제시하세요.
- 기간이 명시되지 않으면 기본으로 최근 7일(7daysAgo ~ yesterday) 데이터를 조회하세요.
- "전환율", "리드", "성과" 관련 질문에는 getGA4Data와 getLeads를 모두 호출하세요.
- "트래픽", "방문자", "채널" 관련 질문에는 getGA4Data를 호출하세요.
- 항상 먼저 데이터를 조회한 뒤 답변하세요. 추가 정보를 요청하지 마세요.
- 여러 주 데이터가 필요하면 getGA4Data를 한 번만 넓은 범위로 호출하세요(예: 56daysAgo~yesterday). 주별로 나눠서 여러 번 호출하지 마세요.
- 오가닉/채널별 주간 추이가 필요하면 getGA4Report에서 date + sessionDefaultChannelGroup 차원을 사용하세요.
- 이전 대화 내용을 참고하되, "표로 보여줘", "테이블로" 등 형식 변경 요청 시에도 반드시 도구를 다시 호출하여 최신 데이터로 응답하세요.
- 마크다운 테이블은 반드시 줄바꿈을 포함한 올바른 형식으로 작성하세요.

답변 규칙:
- 구체적 수치를 반드시 포함
- 핵심 인사이트를 bullet point(• )로 작성
- 실행 가능한 액션 아이템 제시
- B2B 서비스이므로 주말 트래픽 저조는 정상
- 한국어로 답변
- 차트가 도움이 되면 chartData 도구를 호출하세요`,
    messages,
    tools: {
      getGA4Data: { description: 'GA4 데이터를 조회합니다. 채널별 세션, 소스별 세션, 일별 방문자, 이벤트 등을 가져옵니다.', inputSchema: ga4Schema, execute: executeGA4 },
      getGA4Report: { description: 'GA4 커스텀 리포트를 실행합니다. 특정 dimension과 metric 조합으로 상세 데이터를 조회합니다.', inputSchema: ga4ReportSchema, execute: executeGA4Report },
      getLeads: { description: 'Odoo CRM 리드 데이터를 조회합니다. 상담신청 건수, Paid/Organic 구분을 가져옵니다.', inputSchema: leadsSchema, execute: executeLeads },
      chartData: { description: '채팅에 차트를 표시합니다. 데이터와 차트 타입을 지정하면 UI에서 렌더링됩니다.', inputSchema: chartSchema },
    },
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
