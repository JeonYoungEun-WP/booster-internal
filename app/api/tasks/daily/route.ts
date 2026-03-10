import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getTeamMemberName, getTeamMemberByName } from '@/src/lib/team'
import { matchDailyToProjects } from '@/src/lib/ai'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const authorEmail = searchParams.get('authorEmail')

    const where: Record<string, unknown> = {}

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    } else if (startDate) {
      where.date = { gte: new Date(startDate) }
    }

    if (authorEmail) {
      where.authorEmail = authorEmail
    }

    const tasks = await prisma.dailyTask.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ tasks })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2021') {
      return NextResponse.json({ tasks: [] })
    }
    console.error('GET /api/tasks/daily error:', e)
    return NextResponse.json(
      { error: 'Failed to fetch daily tasks' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamsMessageId, authorEmail, authorDisplayName, content, date, secret, source } = body

    // Teams webhook 인증
    if (secret && secret !== process.env.TEAMS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // 팀원 확인: 이메일 또는 이름(displayName)으로 조회
    let authorName: string | null = null
    let resolvedEmail = authorEmail || ''

    if (authorEmail) {
      authorName = await getTeamMemberName(authorEmail)
    }

    if (!authorName && authorDisplayName) {
      const member = await getTeamMemberByName(authorDisplayName)
      if (member) {
        authorName = member.name
        resolvedEmail = member.email
      }
    }

    if (!authorName) {
      return NextResponse.json(
        { error: 'Unknown team member' },
        { status: 400 },
      )
    }

    // 중복 체크 (Teams 메시지)
    if (teamsMessageId) {
      const existing = await prisma.dailyTask.findUnique({
        where: { teamsMessageId },
      })
      if (existing) {
        return NextResponse.json({ ok: true, id: existing.id, duplicate: true })
      }
    }

    const task = await prisma.dailyTask.create({
      data: {
        date: new Date(date),
        authorEmail: resolvedEmail,
        authorName,
        content,
        source: source === 'MANUAL' ? 'MANUAL' : 'TEAMS',
        teamsMessageId: teamsMessageId || null,
      },
    })

    // AI 프로젝트 매칭 (비동기, 실패해도 응답에 영향 없음)
    let projectMatches: string[] = []
    try {
      const projects = await prisma.project.findMany({
        where: { status: 'IN_PROGRESS' },
        select: { id: true, title: true, description: true, status: true },
      })

      if (projects.length > 0 && process.env.GEMINI_API_KEY) {
        const matches = await matchDailyToProjects(authorName, content, projects)
        projectMatches = matches.map((m) => m.projectTitle)

        // ProjectActivity 생성 + endDate 갱신
        for (const match of matches) {
          await prisma.projectActivity.create({
            data: {
              projectId: match.projectId,
              date: new Date(date),
              authorEmail: resolvedEmail,
              authorName,
              summary: match.summary,
              dailyTaskId: task.id,
            },
          })

          // 프로젝트 endDate를 최신 활동일로 갱신
          const project = projects.find((p) => p.id === match.projectId)
          if (project) {
            await prisma.project.update({
              where: { id: match.projectId },
              data: { endDate: new Date(date) },
            })
          }
        }
      }
    } catch (aiError) {
      console.error('AI project matching failed (non-blocking):', aiError)
    }

    return NextResponse.json({ ok: true, id: task.id, author: authorName, projectMatches })
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2021') {
      return NextResponse.json({ error: '테이블이 아직 생성되지 않았습니다.' }, { status: 503 })
    }
    console.error('POST /api/tasks/daily error:', e)
    return NextResponse.json(
      { error: 'Failed to create daily task' },
      { status: 500 },
    )
  }
}
