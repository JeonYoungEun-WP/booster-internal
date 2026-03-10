import { useState, useEffect } from 'react'
import { supabase } from '@/src/lib/supabase'
import { searchRead, searchCount } from '@/src/lib/odoo'

const ODOO_TO_SB: Record<string, string> = {
  name: 'name',
  partner_name: 'partner_name',
  email_from: 'email_from',
  expected_revenue: 'expected_revenue',
  stage_id: 'stage_name',
  user_id: 'user_name',
  create_date: 'create_date',
  x_studio_selection_field_49m_1i3fcoqk9: 'industry',
  x_studio_selection_field_45h_1i3fd9s90: 'product',
  x_studio_selection_field_oo_1i57nj2og: 'platform',
  x_studio_selection_field_8p8_1i3up6bfn: 'source',
  x_studio_selection_field_5f4_1i3up2qg3: 'medium',
  'x_studio_': 'campaign', // TODO: 실제 Odoo 캠페인 필드명 확인 필요
  x_studio_char_field_1vr_1i3fco0k9: 'landing',
  x_studio_char_field_3ao_1i3fcoas5: 'keyword',
}

function mapRow(row: Record<string, unknown>) {
  const result: Record<string, unknown> = { id: row.id }
  for (const [odooKey, sbCol] of Object.entries(ODOO_TO_SB)) {
    result[odooKey] = row[sbCol] ?? '-'
  }
  return result
}

interface UseLeadsOptions {
  limit?: number
  offset?: number
  sortField?: string
  sortDir?: 'asc' | 'desc'
}

export function useLeads({
  limit = 20,
  offset = 0,
  sortField = 'create_date',
  sortDir = 'desc',
}: UseLeadsOptions) {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'supabase' | 'odoo'>('supabase')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const sbSortField = ODOO_TO_SB[sortField] || sortField

    const fetchSupabase = async () => {
      if (!supabase) throw new Error('Supabase not configured')
      const { data: rows, error: sbErr, count } = await supabase
        .from('odoo_leads')
        .select('*', { count: 'exact' })
        .order(sbSortField, { ascending: sortDir === 'asc' })
        .range(offset, offset + limit - 1)

      if (sbErr) throw sbErr
      return { records: (rows || []).map(mapRow), total: count || 0 }
    }

    const fetchOdoo = async () => {
      const fields = Object.keys(ODOO_TO_SB)
      const [records, count] = await Promise.all([
        searchRead('crm.lead', [], fields, { limit, offset, order: `${sortField} ${sortDir}` }),
        searchCount('crm.lead', []),
      ])
      return { records, total: count as number }
    }

    fetchSupabase()
      .then(({ records, total }) => {
        if (cancelled) return
        setData(records)
        setTotal(total)
        setSource('supabase')
      })
      .catch(() =>
        fetchOdoo().then(({ records, total }) => {
          if (cancelled) return
          setData(records)
          setTotal(total)
          setSource('odoo')
        })
      )
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [limit, offset, sortField, sortDir])

  return { data, total, loading, error, source }
}

export interface MonthData {
  year: number
  month: number
  daysInMonth: number
  counts: Record<number, number>
}

export function useMonthlyLeadCounts() {
  const [months, setMonths] = useState<MonthData[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()

  // 이번 달 + 지난 달 (2개월)
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1
  const prevYear = curMonth === 0 ? curYear - 1 : curYear

  // KST 기준 지난달 1일 ~ 이번달 말일을 UTC로 변환
  const kstStart = new Date(Date.UTC(prevYear, prevMonth, 1) - 9 * 60 * 60 * 1000)
  const kstEnd = new Date(Date.UTC(curYear, curMonth + 1, 1) - 9 * 60 * 60 * 1000)
  const startDate = kstStart.toISOString().replace('T', ' ').slice(0, 19)
  const endDate = kstEnd.toISOString().replace('T', ' ').slice(0, 19)

  useEffect(() => {
    let cancelled = false

    const fetchSupabase = async () => {
      if (!supabase) throw new Error('No supabase')
      const { data: rows, error: sbErr } = await supabase
        .from('odoo_leads')
        .select('create_date')
        .gte('create_date', startDate)
        .lt('create_date', endDate)
        .limit(2000)

      if (sbErr) throw sbErr
      return rows || []
    }

    const fetchOdoo = async () => {
      return searchRead(
        'crm.lead',
        [['create_date', '>=', startDate], ['create_date', '<', endDate]],
        ['create_date'],
        { limit: 2000, order: 'create_date asc' },
      )
    }

    const process = (records: { create_date: string }[]) => {
      // 월별로 분리
      const curMap: Record<number, number> = {}
      const prevMap: Record<number, number> = {}

      records.forEach((r) => {
        const utc = new Date(String(r.create_date).replace(' ', 'T') + 'Z')
        const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
        const m = kst.getUTCMonth()
        const y = kst.getUTCFullYear()
        const day = kst.getUTCDate()

        if (y === curYear && m === curMonth) {
          curMap[day] = (curMap[day] || 0) + 1
        } else if (y === prevYear && m === prevMonth) {
          prevMap[day] = (prevMap[day] || 0) + 1
        }
      })

      if (!cancelled) {
        setMonths([
          { year: curYear, month: curMonth, daysInMonth: new Date(curYear, curMonth + 1, 0).getDate(), counts: curMap },
          { year: prevYear, month: prevMonth, daysInMonth: new Date(prevYear, prevMonth + 1, 0).getDate(), counts: prevMap },
        ])
      }
    }

    fetchSupabase()
      .then(process)
      .catch(() => fetchOdoo().then(process))
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [startDate, endDate])

  return { months, loading }
}
