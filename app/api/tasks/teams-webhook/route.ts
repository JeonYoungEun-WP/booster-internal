import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getTeamMemberByName } from '@/src/lib/team'
import { matchDailyToProjects } from '@/src/lib/ai'

/**
 * Teams HTML 새니타이징 — 허용된 태그만 보존, 나머지 제거
 */
function sanitizeTeamsHtml(html: string): string {
  const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'code', 'pre',
    'ul', 'ol', 'li', 'br', 'a', 'span', 'p', 'div']
  const tagPattern = ALLOWED_TAGS.map(t => `\\/?${t}`).join('|')
  const allowedRegex = new RegExp(`<(${tagPattern})(\\s[^>]*)?>`, 'gi')

  // script/iframe 등 위험 태그 완전 제거 (내용 포함)
  let safe = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '') // onclick 등 이벤트 핸들러 제거
    .replace(/javascript:/gi, '')

  // 허용 태그만 보존, 나머지 제거
  const parts: string[] = []
  let lastIdx = 0
  const tagRegex = /<[^>]+>/g
  let match
  while ((match = tagRegex.exec(safe)) !== null) {
    parts.push(safe.slice(lastIdx, match.index))
    if (allowedRegex.test(match[0])) {
      parts.push(match[0])
    }
    allowedRegex.lastIndex = 0
    lastIdx = match.index + match[0].length
  }
  parts.push(safe.slice(lastIdx))

  return parts.join('')
}

/**
 * POST /api/tasks/teams-webhook
 * Teams 메시지 원본 데이터를 그대로 받아서 파싱
 * Power Automate에서 "메시지 세부 정보 가져오기" 출력을 그대로 전달
 * HTML 원본을 새니타이징 후 저장, AI에는 plainText 사용
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // secret 확인 (헤더 또는 body)
    const secret = body.secret || request.headers.get('x-webhook-secret')
    if (secret !== process.env.TEAMS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }

    // Teams 메시지 데이터 파싱 (다양한 구조 지원)
    const message = body.message || body

    const messageId = message.id || message.messageId || body.teamsMessageId || ''
    const displayName = message.from?.user?.displayName || body.authorDisplayName || ''
    const htmlContent = message.body?.content || ''
    const plainContent = message.body?.plainTextContent || body.content || ''
    // HTML이 있으면 새니타이징 후 저장, 없으면 plainText
    const content = htmlContent ? sanitizeTeamsHtml(htmlContent) : plainContent
    // AI 매칭에는 항상 순수 텍스트 사용
    const plainTextForAI = plainContent || htmlContent.replace(/<[^>]+>/g, '')
    const chatId = message.chatId || message.conversationId || ''

    if ((plainContent || content).trim() === '') {
      return NextResponse.json({ error: 'Empty message content' }, { status: 400 })
    }

    // 이름으로 팀원 조회
    const member = displayName ? await getTeamMemberByName(displayName) : null
    if (!member) {
      return NextResponse.json(
        { error: `Unknown team member: ${displayName}` },
        { status: 400 },
      )
    }

    // 중복 체크
    if (messageId) {
      const existing = await prisma.dailyTask.findUnique({
        where: { teamsMessageId: String(messageId) },
      })
      if (existing) {
        return NextResponse.json({ ok: true, id: existing.id, duplicate: true })
      }
    }

    // 오늘 날짜 (KST)
    const now = new Date()
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const dateStr = kstDate.toISOString().slice(0, 10)

    const task = await prisma.dailyTask.create({
      data: {
        date: new Date(dateStr),
        authorEmail: member.email,
        authorName: member.name,
        content: content.trim(),
        source: 'TEAMS',
        teamsMessageId: messageId ? String(messageId) : null,
      },
    })

    // AI 프로젝트 매칭
    let projectMatches: string[] = []
    try {
      const projects = await prisma.project.findMany({
        where: { status: 'IN_PROGRESS' },
        select: { id: true, title: true, description: true, status: true },
      })

      if (projects.length > 0 && process.env.GEMINI_API_KEY) {
        const matches = await matchDailyToProjects(member.name, plainTextForAI, projects)
        projectMatches = matches.map((m) => m.projectTitle)

        for (const match of matches) {
          await prisma.projectActivity.create({
            data: {
              projectId: match.projectId,
              date: new Date(dateStr),
              authorEmail: member.email,
              authorName: member.name,
              summary: match.summary,
              dailyTaskId: task.id,
            },
          })

          await prisma.project.update({
            where: { id: match.projectId },
            data: { endDate: new Date(dateStr) },
          })
        }
      }
    } catch (aiError) {
      console.error('AI project matching failed (non-blocking):', aiError)
    }

    return NextResponse.json({
      ok: true,
      id: task.id,
      author: member.name,
      chatId,
      projectMatches,
      contentType: htmlContent ? 'html' : 'text',
    })
  } catch (error) {
    console.error('POST /api/tasks/teams-webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process Teams message' },
      { status: 500 },
    )
  }
}
