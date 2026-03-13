import { NextRequest, NextResponse } from 'next/server'

const IMWEB_API_KEY = process.env.IMWEB_API_KEY
const IMWEB_API_SECRET = process.env.IMWEB_API_SECRET

let cachedToken: string | null = null
let tokenTime = 0
const TOKEN_TTL = 50 * 60 * 1000 // 토큰 50분 캐시 (IMWEB 토큰 유효기간 60분)

async function getImwebToken(): Promise<string> {
  if (cachedToken && Date.now() - tokenTime < TOKEN_TTL) {
    return cachedToken
  }

  const res = await fetch('https://api.imweb.me/v2/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: IMWEB_API_KEY, secret: IMWEB_API_SECRET }),
  })
  const data = await res.json()
  if (data.code !== 200) {
    if (cachedToken) return cachedToken
    throw new Error(data.msg || 'IMWEB auth failed')
  }
  cachedToken = data.access_token
  tokenTime = Date.now()
  return data.access_token
}

interface ImwebMember {
  join_time: string // "YYYY-MM-DD HH:mm:ss"
}

// 메모리 캐시: 전체 회원 목록 (30분간 유지)
let cachedMembers: ImwebMember[] | null = null
let cacheTime = 0
const CACHE_TTL = 30 * 60 * 1000

// 요청 진행 중 플래그 (중복 호출 방지)
let fetchingMembers = false

async function getAllMembers(token: string): Promise<ImwebMember[]> {
  if (cachedMembers && Date.now() - cacheTime < CACHE_TTL) {
    return cachedMembers
  }

  // 이미 다른 요청이 페이지네이션 중이면 캐시 또는 빈 배열 반환
  if (fetchingMembers) {
    return cachedMembers || []
  }

  fetchingMembers = true
  try {
    let page = 1
    const allMembers: ImwebMember[] = []

    while (true) {
      // 페이지 간 딜레이 (레이트 리밋 방지)
      if (page > 1) {
        await new Promise((r) => setTimeout(r, 500))
      }

      const res = await fetch(`https://api.imweb.me/v2/member/members?page=${page}`, {
        headers: { 'access-token': token },
      })
      const data = await res.json()

      if (data.code !== 200) {
        console.error(`IMWEB member page ${page} error:`, data.code, data.msg)
        // rate limit 시 지금까지 모은 데이터라도 캐시
        if (allMembers.length > 0) {
          cachedMembers = allMembers
          cacheTime = Date.now()
          return allMembers
        }
        if (cachedMembers) return cachedMembers
        throw new Error(data.msg || 'IMWEB member API failed')
      }

      const list: ImwebMember[] = data.data?.list || []
      if (list.length === 0) break

      allMembers.push(...list)

      const dataCount = parseInt(data.data?.pagenation?.data_count || '0', 10)
      const pageCount = parseInt(data.data?.pagenation?.page_count || '20', 10)
      const totalPages = Math.ceil(dataCount / pageCount)
      if (page >= totalPages) break
      page++
    }

    cachedMembers = allMembers
    cacheTime = Date.now()
    return allMembers
  } catch (error) {
    if (cachedMembers) return cachedMembers
    throw error
  } finally {
    fetchingMembers = false
  }
}

/**
 * GET /api/imweb?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * IMWEB 회원 목록에서 기간 내 가입자 수를 조회
 */
export async function GET(request: NextRequest) {
  try {
    if (!IMWEB_API_KEY || !IMWEB_API_SECRET) {
      return NextResponse.json({ error: 'IMWEB not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const token = await getImwebToken()
    const allMembers = await getAllMembers(token)

    // 날짜 필터링
    let filtered = allMembers
    if (startDate || endDate) {
      filtered = allMembers.filter(m => {
        const joinDate = m.join_time?.split(' ')[0] // "YYYY-MM-DD"
        if (!joinDate) return false
        if (startDate && joinDate < startDate) return false
        if (endDate && joinDate > endDate) return false
        return true
      })
    }

    return NextResponse.json({
      signupCount: filtered.length,
    })
  } catch (error) {
    const msg = (error as Error).message || 'Unknown error'
    console.error('GET /api/imweb error:', msg)
    // 레이트 리밋이면 503으로 구분
    const status = msg.includes('TOO MANY') ? 503 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
