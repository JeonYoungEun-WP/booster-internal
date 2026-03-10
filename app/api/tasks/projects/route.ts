import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'desc' }],
      include: {
        activities: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json({ projects })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2021') {
      return NextResponse.json({ projects: [] })
    }
    console.error('GET /api/tasks/projects error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, startDate, endDate, color } = body

    const project = await prisma.project.create({
      data: {
        title,
        description: description || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        color: color || null,
      },
    })

    return NextResponse.json({ ok: true, project })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2021') {
      return NextResponse.json({ error: '테이블이 아직 생성되지 않았습니다.' }, { status: 503 })
    }
    console.error('POST /api/tasks/projects error:', e)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 },
    )
  }
}
