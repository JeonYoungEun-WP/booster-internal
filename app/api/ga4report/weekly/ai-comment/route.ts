import { NextRequest, NextResponse } from 'next/server'
import { generateTrafficAnalysis, type TrafficAnalysisInput } from '@/src/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const data: TrafficAnalysisInput = await request.json()
    const comment = await generateTrafficAnalysis(data)
    return NextResponse.json({ comment })
  } catch (error) {
    console.error('AI comment error:', error)
    return NextResponse.json({ comment: '' }, { status: 500 })
  }
}
