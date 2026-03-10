import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { generateWeeklySummary } from '@/src/lib/ai'
import { getAllTeamMembers } from '@/src/lib/team'

/**
 * POST /api/tasks/weekly/generate
 * AI 주간 요약 수동 트리거
 *
 * Body (optional):
 *   weekStart: "YYYY-MM-DD" (기본: 이번주 월요일 → 전주 월~금 요약)
 *   authorEmail: "xxx@wepic.kr" (특정 팀원만, 없으면 전체)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { weekStart: weekStartParam, authorEmail: authorEmailParam } = body as {
      weekStart?: string
      authorEmail?: string
    }

    // 이번 주 월요일 계산 (KST)
    const now = new Date()
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const day = kstNow.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    const thisMonday = new Date(kstNow)
    thisMonday.setUTCDate(kstNow.getUTCDate() + diff)
    const thisMondayStr =
      weekStartParam || thisMonday.toISOString().slice(0, 10)

    // 전주 월~금 범위
    const weekStartDate = new Date(thisMondayStr)
    const prevMonday = new Date(weekStartDate)
    prevMonday.setDate(weekStartDate.getDate() - 7)
    const prevFriday = new Date(prevMonday)
    prevFriday.setDate(prevMonday.getDate() + 4)

    const prevMondayStr = prevMonday.toISOString().slice(0, 10)
    const prevFridayStr = prevFriday.toISOString().slice(0, 10)

    // 대상 팀원
    const allMembers = await getAllTeamMembers()
    const members = authorEmailParam
      ? allMembers.filter((m) => m.email === authorEmailParam)
      : allMembers

    if (members.length === 0) {
      return NextResponse.json({ error: 'No team members found' }, { status: 400 })
    }

    const results: { email: string; name: string; generated: boolean; summary?: string }[] = []

    for (const member of members) {
      // 전주 데일리 업무 조회
      const tasks = await prisma.dailyTask.findMany({
        where: {
          authorEmail: member.email,
          date: {
            gte: new Date(prevMondayStr),
            lte: new Date(prevFridayStr),
          },
        },
        orderBy: { date: 'asc' },
      })

      if (tasks.length === 0) {
        results.push({ email: member.email, name: member.name, generated: false })
        continue
      }

      // Claude AI 요약 생성
      const dailyEntries = tasks.map((t) => ({
        date: t.date.toISOString().slice(0, 10),
        content: t.content,
      }))

      const summary = await generateWeeklySummary(
        member.name,
        prevMondayStr,
        prevFridayStr,
        dailyEntries,
      )

      // WeeklyReport에 upsert
      await prisma.weeklyReport.upsert({
        where: {
          weekStart_authorEmail: {
            weekStart: new Date(thisMondayStr),
            authorEmail: member.email,
          },
        },
        update: {
          weeklySummary: summary,
          summaryGeneratedAt: new Date(),
        },
        create: {
          weekStart: new Date(thisMondayStr),
          authorEmail: member.email,
          authorName: member.name,
          weeklySummary: summary,
          summaryGeneratedAt: new Date(),
        },
      })

      results.push({
        email: member.email,
        name: member.name,
        generated: true,
        summary: summary.slice(0, 200) + (summary.length > 200 ? '...' : ''),
      })
    }

    return NextResponse.json({
      ok: true,
      weekStart: thisMondayStr,
      prevWeek: `${prevMondayStr} ~ ${prevFridayStr}`,
      results,
    })
  } catch (error) {
    console.error('POST /api/tasks/weekly/generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate weekly summary' },
      { status: 500 },
    )
  }
}
