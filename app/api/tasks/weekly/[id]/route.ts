import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { weeklyPlan, weeklySummary } = body

    const data: Record<string, unknown> = {}
    if (weeklyPlan !== undefined) data.weeklyPlan = weeklyPlan
    if (weeklySummary !== undefined) {
      data.weeklySummary = weeklySummary
      data.summaryGeneratedAt = new Date()
    }

    const report = await prisma.weeklyReport.update({
      where: { id },
      data,
    })

    return NextResponse.json({ ok: true, report })
  } catch (error) {
    console.error('PUT /api/tasks/weekly/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update weekly report' },
      { status: 500 },
    )
  }
}
