// 임시 디버그 라우트 — DB 연결 진단용. 사용 후 즉시 삭제할 것.
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

function maskUrl(url: string | undefined) {
  if (!url) return null
  try {
    const u = new URL(url)
    return {
      protocol: u.protocol,
      username: u.username,
      passwordLength: u.password.length,
      passwordHasPercent: u.password.includes('%'),
      host: u.hostname,
      port: u.port,
      database: u.pathname.replace(/^\//, ''),
      search: u.search,
      hasPgbouncerParam: u.searchParams.get('pgbouncer'),
      connectionLimit: u.searchParams.get('connection_limit'),
    }
  } catch (e) {
    return { parseError: String(e), rawLength: url.length }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const databaseUrl = maskUrl(process.env.DATABASE_URL)
  const directUrl = maskUrl(process.env.DIRECT_URL)

  // 실제 pg.Pool로 connect 시도
  let pgPing: { ok: boolean; error?: string; nowResult?: string } = { ok: false }
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 5000,
    })
    const r = await pool.query('select now() as now')
    pgPing = { ok: true, nowResult: String(r.rows[0]?.now) }
    await pool.end()
  } catch (e) {
    pgPing = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json({
    runtime: {
      vercelEnv: process.env.VERCEL_ENV ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
    },
    databaseUrl,
    directUrl,
    pgPing,
  })
}
