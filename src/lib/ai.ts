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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
    const entries = dailyEntries
      .map((e) => `- ${e.date}: ${e.content}`)
      .join('\n')

    const prompt = `다음은 ${memberName}의 ${startDate} ~ ${endDate} 주간 업무 내역입니다:
${entries}

위 내용을 바탕으로 주간 업무 요약을 작성해주세요. 간결하게 핵심 성과와 진행 사항을 정리해주세요. 마크다운 없이 텍스트로만 작성해주세요.`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (!res.ok) {
      return dailyEntries.map((e) => `[${e.date}] ${e.content}`).join('\n')
    }

    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '요약 생성 실패'
  } catch {
    return dailyEntries.map((e) => `[${e.date}] ${e.content}`).join('\n')
  }
}
