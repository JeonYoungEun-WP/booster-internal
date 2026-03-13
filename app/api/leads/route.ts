import { NextRequest, NextResponse } from 'next/server'

const ODOO_URL = process.env.ODOO_URL || 'https://works.wepick.kr'
const ODOO_DB = process.env.ODOO_DB || 'works'
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

const BULK_THRESHOLD = 5 // 같은 초에 이 수 이상이면 벌크 임포트로 간주

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

// 벌크 임포트 ID 목록 (캐시: 30분)
let bulkCache: { ids: number[]; ts: number } | null = null

async function getBulkImportIds(uid: number): Promise<number[]> {
  if (bulkCache && Date.now() - bulkCache.ts < 30 * 60 * 1000) {
    return bulkCache.ids
  }

  const all = await rpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'search_read',
    [[]],
    { fields: ['id', 'create_date'], order: 'id asc', limit: false },
  ]) as { id: number; create_date: string }[]

  // 같은 초에 생성된 레코드 그룹화
  const bySecond: Record<string, number[]> = {}
  for (const r of all) {
    const sec = r.create_date // 초 단위까지 동일
    if (!bySecond[sec]) bySecond[sec] = []
    bySecond[sec].push(r.id)
  }

  // BULK_THRESHOLD 이상인 그룹의 ID를 수집
  const bulkIds: number[] = []
  for (const ids of Object.values(bySecond)) {
    if (ids.length >= BULK_THRESHOLD) {
      bulkIds.push(...ids)
    }
  }

  bulkCache = { ids: bulkIds, ts: Date.now() }
  return bulkIds
}

const FIELDS = [
  'name', 'partner_name', 'email_from', 'expected_revenue',
  'stage_id', 'user_id', 'create_date',
  'x_studio_selection_field_49m_1i3fcoqk9',
  'x_studio_selection_field_45h_1i3fd9s90',
  'x_studio_selection_field_oo_1i57nj2og',
  'x_studio_selection_field_8p8_1i3up6bfn',
  'x_studio_selection_field_5f4_1i3up2qg3',
  'x_studio_',
  'x_studio_char_field_1vr_1i3fco0k9',
  'x_studio_char_field_3ao_1i3fcoas5',
]

/**
 * GET /api/leads?limit=20&offset=0&sortField=create_date&sortDir=desc
 * GET /api/leads?action=monthly&startDate=...&endDate=...
 */
export async function GET(request: NextRequest) {
  try {
    if (!ODOO_USERNAME || !ODOO_API_KEY) {
      return NextResponse.json({ error: 'Odoo not configured' }, { status: 503 })
    }

    const uid = await rpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
    if (!uid) return NextResponse.json({ error: 'Odoo auth failed' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // 벌크 임포트 제외 도메인
    const bulkIds = await getBulkImportIds(uid)
    const baseDomain: unknown[] = bulkIds.length > 0
      ? [['id', 'not in', bulkIds]]
      : []

    if (action === 'monthly') {
      const startDate = searchParams.get('startDate') || ''
      const endDate = searchParams.get('endDate') || ''
      const domain: unknown[] = [...baseDomain]
      if (startDate) domain.push(['create_date', '>=', startDate])
      if (endDate) domain.push(['create_date', '<', endDate])

      const records = await rpc('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'search_read',
        [domain],
        { fields: ['create_date'], limit: 2000, order: 'create_date asc' },
      ])

      return NextResponse.json({ records: records || [] })
    }

    // Default: paginated lead list
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortField = searchParams.get('sortField') || 'create_date'
    const sortDir = searchParams.get('sortDir') || 'desc'

    const [records, total] = await Promise.all([
      rpc('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'search_read',
        [baseDomain],
        { fields: FIELDS, limit, offset, order: `${sortField} ${sortDir}` },
      ]),
      rpc('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'search_count',
        [baseDomain],
      ]),
    ])

    return NextResponse.json({ records: records || [], total: total || 0 })
  } catch (error) {
    console.error('GET /api/leads error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
