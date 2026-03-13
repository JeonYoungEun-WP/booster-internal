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
    const entries = dailyEntries
      .map((e) => `- ${e.date}: ${e.content}`)
      .join('\n')

    const prompt = `다음은 ${memberName}의 ${startDate} ~ ${endDate} 주간 업무 내역입니다:
${entries}

위 내용을 바탕으로 주간 업무 요약을 작성해주세요.

규칙:
1. 중복 제거: 여러 날에 걸쳐 동일하거나 유사한 업무가 반복되면 반드시 하나로 합쳐서 진행 경과만 요약 (예: "AX 스프린트: 통합본 수정 → 리뷰 → 반영 완료")
2. 루틴 통합: 매일 반복되는 루틴(리드수 확인, 성과 입력, 스크럼 등)은 모두 "루틴 업무 수행" 한 줄로 통합
3. 회의/미팅은 결론이나 의사결정 사항만 한 줄로
4. 회고는 핵심 인사이트 한 줄로 축약
5. 총 3~6줄로 최대한 컴팩트하게
6. 마크다운 없이 텍스트로만, 각 항목은 "• " 로 시작
7. 날짜별로 나누지 말고 주제/프로젝트별로 묶어서 정리`

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

    if (!res.ok) {
      const errText = await res.text()
      console.error('Gemini API error:', res.status, errText.slice(0, 300))
      return dailyEntries.map((e) => `[${e.date}] ${e.content}`).join('\n')
    }

    const data = await res.json()
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!result) {
      console.error('Gemini empty response:', JSON.stringify(data).slice(0, 300))
      return '요약 생성 실패'
    }
    return result
  } catch (err) {
    console.error('Gemini summary error:', err)
    return dailyEntries.map((e) => `[${e.date}] ${e.content}`).join('\n')
  }
}
