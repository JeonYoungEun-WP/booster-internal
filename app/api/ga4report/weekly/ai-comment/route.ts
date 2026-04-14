import { NextRequest, NextResponse } from 'next/server'
import { generateTrafficAnalysis, generateCustomAnalysis, type TrafficAnalysisInput } from '@/src/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // 커스텀 쿼리 모드
    if (data.customQuery && data.context) {
      const comment = await generateCustomAnalysis(data.customQuery, data.context)
      return NextResponse.json({ comment })
    }

    // 기존 주간 트래픽 분석 모드
    const comment = await generateTrafficAnalysis(data as TrafficAnalysisInput)
    return NextResponse.json({ comment })
  } catch (error) {
    console.error('AI comment error:', error)
    return NextResponse.json({ comment: '' }, { status: 500 })
  }
}
