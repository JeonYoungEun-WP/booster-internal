export interface TrafficAnalysisInput {
  currentWeek: {
    label: string
    uvs: number
    pvs: number
    paidUvs: number
    organicUvs: number
    channels: Record<string, number>
  }
  prevWeek: {
    label: string
    uvs: number
    pvs: number
    paidUvs: number
    organicUvs: number
    channels: Record<string, number>
  }
  currentLeads: { total: number; paid: number; organic: number }
  prevLeads: { total: number; paid: number; organic: number }
  yoyUvs: number | null
  conversionRate: number
  prevConversionRate: number
  isIncomplete: boolean
}

export async function generateTrafficAnalysis(data: TrafficAnalysisInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return ''

  try {
    const wow = (cur: number, prev: number) => {
      if (prev === 0) return cur > 0 ? '+∞' : '0%'
      return `${(((cur - prev) / prev) * 100).toFixed(1)}%`
    }

    const channelLines = Object.entries(data.currentWeek.channels)
      .sort(([, a], [, b]) => b - a)
      .map(([ch, uv]) => {
        const prev = data.prevWeek.channels[ch] || 0
        return `  ${ch}: ${uv} (전주 ${prev}, WoW ${wow(uv, prev)})`
      })
      .join('\n')

    const prompt = `위픽부스터(B2B 마케팅 SaaS) 주간 트래픽 데이터를 분석해주세요.

■ 이번 주 (${data.currentWeek.label})${data.isIncomplete ? ' [진행 중 - 불완전 데이터]' : ''}
- UV: ${data.currentWeek.uvs} (Paid ${data.currentWeek.paidUvs} / Organic ${data.currentWeek.organicUvs})
- PV: ${data.currentWeek.pvs}
- 리드: ${data.currentLeads.total}건 (Paid ${data.currentLeads.paid} / Organic ${data.currentLeads.organic})
- 전환율: ${data.conversionRate}%

■ 전주 (${data.prevWeek.label})
- UV: ${data.prevWeek.uvs} (Paid ${data.prevWeek.paidUvs} / Organic ${data.prevWeek.organicUvs})
- PV: ${data.prevWeek.pvs}
- 리드: ${data.prevLeads.total}건 (Paid ${data.prevLeads.paid} / Organic ${data.prevLeads.organic})
- 전환율: ${data.prevConversionRate}%

■ WoW 변화
- UV: ${wow(data.currentWeek.uvs, data.prevWeek.uvs)}
- PV: ${wow(data.currentWeek.pvs, data.prevWeek.pvs)}
- 리드: ${wow(data.currentLeads.total, data.prevLeads.total)}
${data.yoyUvs !== null ? `\n■ YoY 전년 동주차 UV: ${data.yoyUvs}` : ''}

■ 채널별 UV
${channelLines}

규칙:
1. 5~8개 핵심 인사이트를 bullet point(• )로 작성
2. 각 포인트는 구체적 수치를 포함하고 액션 아이템 제시
3. B2B 서비스이므로 주말 트래픽 저조는 언급하지 마세요
4. 채널별 유입 변화에서 주목할 점을 반드시 포함
5. Paid vs Organic 비율 변화와 효율성 분석 포함
6. 전환율 변화 원인 추정 포함
7. 한국어로 작성, 마크다운 없이 텍스트만`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (!res.ok) return ''
    const result = await res.json()
    return result.candidates?.[0]?.content?.parts?.[0]?.text || ''
  } catch (err) {
    console.error('Traffic analysis error:', err)
    return ''
  }
}

interface Project {
  id: string
  title: string
  description: string | null
  status: string
}

interface ProjectMatch {
  projectId: string
  projectTitle: string
  summary: string
}

export async function matchDailyToProjects(
  authorName: string,
  content: string,
  projects: Project[],
): Promise<ProjectMatch[]> {
  // Gemini API key가 없으면 빈 배열 반환
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []

  try {
    const projectList = projects
      .map((p) => `- [${p.id}] ${p.title}: ${p.description || '설명 없음'}`)
      .join('\n')

    const prompt = `다음은 ${authorName}의 업무 내용입니다:
"${content}"

아래 프로젝트 목록에서 이 업무와 관련된 프로젝트를 매칭해주세요.
${projectList}

관련 프로젝트가 있으면 JSON 배열로 응답해주세요: [{"projectId": "...", "projectTitle": "...", "summary": "한줄 요약"}]
없으면 빈 배열 []로 응답해주세요. JSON만 출력하세요.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (!res.ok) return []

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    return JSON.parse(jsonMatch[0]) as ProjectMatch[]
  } catch {
    return []
  }
}

export async function generateWeeklySummary(
  memberName: string,
  startDate: string,
  endDate: string,
  dailyEntries: { date: string; content: string }[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return dailyEntries.map((e) => `[${e.date}] ${e.content}`).join('\n')
  }

  try {
    // HTML 엔티티, 체크박스, 특수문자 정리
    const cleanContent = (s: string) =>
      s.replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&').replace(/&#\d+;/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\[x\]\s*/gi, '').replace(/\[ \]\s*/gi, '')
        .replace(/\*+/g, '').replace(/ㄴ/g, '- ')
        .replace(/✔/g, '').replace(/⇒/g, '')
        .replace(/\n{2,}/g, '\n').trim()

    const entries = dailyEntries
      .map((e) => {
        const cleaned = cleanContent(e.content)
        // 각 날짜별 최대 300자로 제한
        return `[${e.date}] ${cleaned.slice(0, 300)}`
      })
      .join('\n')

    const prompt = `아래는 ${memberName}의 주간 업무 로그다. 3~5줄로 요약해라.

${entries}

[출력 규칙]
- 반드시 3~5줄. 각 줄은 "• "로 시작
- 같은 프로젝트는 한 줄로 병합 (예: "AX 프로젝트: 결제→주문→마이페이지 개발")
- 루틴(리드입력, 성과확인, 스크럼 등)은 전부 "루틴 업무" 한 줄
- 회의는 "주요 미팅 N건" 한 줄로 통합
- 날짜 쓰지 마. 마크다운 금지. 설명 금지. 나열만 해`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 256,
            temperature: 0.1,
          },
        }),
      },
    )

    if (!res.ok) {
      const errText = await res.text()
      console.error('Gemini API error:', res.status, errText.slice(0, 500))
      return `[AI 요약 실패: ${res.status}] 수동 확인 필요`
    }

    const data = await res.json()
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!result) {
      console.error('Gemini empty response:', JSON.stringify(data).slice(0, 500))
      return '[AI 요약 실패] 빈 응답'
    }
    return result
  } catch (err) {
    console.error('Gemini summary error:', err)
    return `[AI 요약 실패] ${(err as Error).message}`
  }
}
