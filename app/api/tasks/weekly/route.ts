import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getTeamMemberName } from '@/src/lib/team'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const authorEmail = searchParams.get('authorEmail')

    const where: Record<string, unknown> = {}
    if (authorEmail) where.authorEmail = authorEmail

    const reports = await prisma.weeklyReport.findMany({
      where,
      orderBy: [{ weekStart: 'desc' }, { authorName: 'asc' }],
    })

    return NextResponse.json({ reports })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2021') {
      return NextResponse.json({ reports: [] })
    }
    console.error('GET /api/tasks/weekly error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch weekly reports' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { weekStart, authorEmail, weeklyPlan } = body

    const authorName = await getTeamMemberName(authorEmail)
    if (!authorName) {
      return NextResponse.json(
        { error: 'Unknown team member' },
        { status: 400 },
      )
    }

    const report = await prisma.weeklyReport.upsert({
      where: {
        weekStart_authorEmail: {
          weekStart: new Date(weekStart),
          authorEmail,
        },
      },
      update: { weeklyPlan },
      create: {
        weekStart: new Date(weekStart),
        authorEmail,
        authorName,
        weeklyPlan,
      },
    })

    return NextResponse.json({ ok: true, report })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2021') {
      return NextResponse.json({ error: '테이블이 아직 생성되지 않았습니다.' }, { status: 503 })
    }
    console.error('POST /api/tasks/weekly error:', e)
    return NextResponse.json(
      { error: 'Failed to save weekly plan' },
      { status: 500 },
    )
  }
}
