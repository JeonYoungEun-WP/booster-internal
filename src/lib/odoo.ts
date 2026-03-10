const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || process.env.ODOO_URL || 'https://works.wepick.kr'
const ODOO_DB = process.env.ODOO_DB || 'works'
const ODOO_USERNAME = process.env.ODOO_USERNAME
const ODOO_API_KEY = process.env.ODOO_API_KEY

let cachedUid: number | null = null

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

async function getUid() {
  if (cachedUid) return cachedUid
  if (!ODOO_USERNAME || !ODOO_API_KEY) throw new Error('Odoo credentials not configured')
  cachedUid = await rpc('common', 'authenticate', [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}])
  if (!cachedUid) throw new Error('Odoo authentication failed')
  return cachedUid
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function searchRead(
  model: string,
  domain: unknown[],
  fields: string[],
  options?: { limit?: number; offset?: number; order?: string },
): Promise<any[]> {
  const uid = await getUid()
  return rpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, model, 'search_read',
    [domain],
    { fields, limit: options?.limit, offset: options?.offset, order: options?.order },
  ])
}

export async function searchCount(
  model: string,
  domain: unknown[],
): Promise<number> {
  const uid = await getUid()
  return rpc('object', 'execute_kw', [
    ODOO_DB, uid, ODOO_API_KEY, model, 'search_count',
    [domain],
  ])
}
