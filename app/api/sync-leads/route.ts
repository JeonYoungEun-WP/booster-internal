import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/auth';

const ODOO_URL = process.env.ODOO_URL || 'https://works.wepick.kr';
const ODOO_DB = process.env.ODOO_DB || 'works';
const ODOO_USERNAME = process.env.ODOO_USERNAME;
const ODOO_API_KEY = process.env.ODOO_API_KEY;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, key);
}

const F: Record<string, string> = {
  industry: 'x_studio_selection_field_49m_1i3fcoqk9',
  product: 'x_studio_selection_field_45h_1i3fd9s90',
  platform: 'x_studio_selection_field_oo_1i57nj2og',
  source: 'x_studio_selection_field_8p8_1i3up6bfn',
  medium: 'x_studio_selection_field_5f4_1i3up2qg3',
  campaign: 'x_studio_', // TODO: 실제 Odoo 캠페인 필드명 확인 필요 (불완전할 수 있음)
  landing: 'x_studio_char_field_1vr_1i3fco0k9',
  keyword: 'x_studio_char_field_3ao_1i3fcoas5',
};

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
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || 'Odoo RPC error');
  return data.result;
}

function extractVal(v: unknown) {
  if (!v || v === false) return null;
  if (Array.isArray(v)) return v[1] || null;
  return v;
}

function extractId(v: unknown) {
  if (!v || v === false) return null;
  if (Array.isArray(v)) return v[0] || null;
  return v;
}

function mapLeadToRow(lead: Record<string, unknown>) {
  return {
    id: lead.id,
    name: lead.name || null,
    partner_name: lead.partner_name || null,
    email_from: lead.email_from || null,
    expected_revenue: lead.expected_revenue || null,
    stage_name: extractVal(lead.stage_id),
    stage_id: extractId(lead.stage_id),
    user_name: extractVal(lead.user_id),
    user_id: extractId(lead.user_id),
    create_date: lead.create_date || null,
    industry: extractVal(lead[F.industry]),
    product: extractVal(lead[F.product]),
    platform: extractVal(lead[F.platform]),
    source: extractVal(lead[F.source]),
    medium: extractVal(lead[F.medium]),
    campaign: extractVal(lead[F.campaign]),
    landing: extractVal(lead[F.landing]),
    keyword: extractVal(lead[F.keyword]),
    synced_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    const uid = await odooRpc('common', 'authenticate', [
      ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {},
    ]);
    if (!uid) return NextResponse.json({ error: 'Odoo auth failed' }, { status: 500 });

    const odooFields = [
      'name', 'partner_name', 'email_from', 'expected_revenue',
      'stage_id', 'user_id', 'create_date',
      ...Object.values(F),
    ];

    const supabase = getSupabase();

    const domain: unknown[] = [];
    if (mode !== 'full') {
      const { data: latest } = await supabase
        .from('odoo_leads')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1);

      if (latest && latest.length > 0) {
        domain.push(['write_date', '>', latest[0].synced_at]);
      }
    }

    let offset = 0;
    const batchSize = 200;
    let totalSynced = 0;

    while (true) {
      const leads = await odooRpc('object', 'execute_kw', [
        ODOO_DB, uid, ODOO_API_KEY, 'crm.lead', 'search_read',
        [domain],
        { fields: [...odooFields, 'write_date'], limit: batchSize, offset, order: 'id asc' },
      ]);

      if (!leads || leads.length === 0) break;

      const rows = leads.map(mapLeadToRow);
      const { error } = await supabase
        .from('odoo_leads')
        .upsert(rows, { onConflict: 'id' });

      if (error) throw new Error(`Supabase upsert error: ${error.message}`);

      totalSynced += leads.length;
      offset += batchSize;

      if (leads.length < batchSize) break;
    }

    return NextResponse.json({
      success: true,
      synced: totalSynced,
      mode: domain.length > 0 ? 'incremental' : 'full',
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
