import { streamText } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { getAccessToken, runGA4Report } from '@/src/lib/ga4-server'

export const maxDuration = 60

const BASE_URL = process.env.VERCEL_URL
  ? 'https://' + process.env.VERCEL_URL
  : 'http://localhost:3001'

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
  startDate: z.string().describe('시작일 (YYYY-MM-DD HH:mm:ss)'),
  endDate: z.string().describe('종료일 (YYYY-MM-DD HH:mm:ss)'),
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

// Tool executors
async function executeGA4(params: GA4Params) {
  const res = await fetch(`${BASE_URL}/api/ga4report?startDate=${params.startDate}&endDate=${params.endDate}`)
  return res.json()
}

async function executeGA4Report(params: GA4ReportParams) {
  try {
    const accessToken = await getAccessToken()
    type RowType = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }
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

async function executeLeads(params: LeadsParams) {
  const res = await fetch(`${BASE_URL}/api/leads?action=monthly&startDate=${encodeURIComponent(params.startDate)}&endDate=${encodeURIComponent(params.endDate)}`)
  const data = await res.json()
  const records: Record<string, unknown>[] = data.records || []
  const paid = records.filter(r => String(r.x_studio_selection_field_8p8_1i3up6bfn || '').toLowerCase() === 'paid').length
  return { total: records.length, paid, organic: records.length - paid }
}

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: google('gemini-2.5-flash'),
    system: `당신은 위픽부스터(B2B 마케팅 SaaS, booster.im)의 데이터 분석가입니다.
사용자의 질문에 GA4, Odoo 데이터를 기반으로 답변합니다.
필요한 데이터는 도구(tool)를 호출하여 가져옵니다.

규칙:
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
  })

  return result.toUIMessageStreamResponse()
}
