import { NextRequest, NextResponse } from 'next/server'

const ODOO_URL = process.env.ODOO_URL || 'https://works.wepick.kr'
const ODOO_DB = process.env.ODOO_DB || 'works'
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

async function rpc(service: string, method: string, args: unknown[]) {
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

/**
 * GET /api/odoo?action=lead-funnel&startDate=...&endDate=...
 * Odoo CRM 리드 단계별 카운트를 조회
 */
export async function GET(request: NextRequest) {
  try {
    if (!ODOO_USERNAME || !ODOO_API_KEY) {
      return NextResponse.json({ error: 'Odoo not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const uid = await rpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
    if (!uid) return NextResponse.json({ error: 'Odoo auth failed' }, { status: 500 })

    if (action === 'lead-funnel') {
      // 날짜 필터 도메인
      const domain: unknown[] = []
      if (startDate) domain.push(['create_date', '>=', startDate])
      if (endDate) domain.push(['create_date', '<=', endDate + ' 23:59:59'])

      // 전체 리드를 stage_id와 함께 조회
      const leads = await rpc('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'read_group',
        [domain, ['stage_id'], ['stage_id']],
        {},
      ])

      // 단계별 집계
      const stages: { name: string; id: number; count: number }[] = (leads || []).map(
        (g: { stage_id: [number, string]; stage_id_count: number }) => ({
          id: g.stage_id?.[0] || 0,
          name: g.stage_id?.[1] || '미지정',
          count: g.stage_id_count || 0,
        }),
      )

      // 퍼널 단계 매핑 (Odoo 단계명 기반)
      const inquiryKeywords = ['새', 'new', '문의', 'inquiry']
      const nurturingKeywords = ['육성', 'nurturing', '검증', 'qualified']
      const consultationKeywords = ['상담', '제안', 'proposal', 'won', '완료', 'closing']

      const matchStage = (stageName: string, keywords: string[]) =>
        keywords.some(k => stageName.toLowerCase().includes(k))

      let inquiryCount = 0
      let nurturingCount = 0
      let consultationCount = 0

      for (const stage of stages) {
        if (matchStage(stage.name, consultationKeywords)) {
          consultationCount += stage.count
        } else if (matchStage(stage.name, nurturingKeywords)) {
          nurturingCount += stage.count
        } else if (matchStage(stage.name, inquiryKeywords)) {
          inquiryCount += stage.count
        }
      }

      return NextResponse.json({
        inquiryCount,
        nurturingCount,
        consultationCount,
        stages,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('GET /api/odoo error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    )
  }
}
