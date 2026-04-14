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

export async function generateCustomAnalysis(query: string, context: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return '분석 기능을 사용할 수 없습니다 (API 키 없음)'

  try {
    const prompt = `당신은 위픽부스터(B2B 마케팅 SaaS)의 데이터 분석가입니다.
아래 데이터를 기반으로 사용자의 질문에 답해주세요.

${context}

[사용자 질문]
${query}

[응답 규칙]
- 구체적 수치를 반드시 포함
- bullet point(• )로 핵심 인사이트 5~8개 작성
- 실행 가능한 액션 아이템 제시
- B2B 서비스이므로 주말 트래픽 저조는 정상
- 한국어로 작성, 마크다운 없이 텍스트만`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.3,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    )

    if (!res.ok) {
      console.error('Gemini custom analysis error:', res.status)
      return '분석 생성에 실패했습니다. 잠시 후 다시 시도해주세요.'
    }

    const result = await res.json()
    return result.candidates?.[0]?.content?.parts?.[0]?.text || '분석 결과를 생성할 수 없습니다.'
  } catch (err) {
    console.error('Custom analysis error:', err)
    return '분석 중 오류가 발생했습니다.'
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
  _memberName: string,
  _startDate: string,
  _endDate: string,
  dailyEntries: { date: string; content: string }[],
): Promise<string> {
  try {
    // HTML 엔티티, 체크박스, 특수문자 정리
    const cleanContent = (s: string) =>
      s.replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&').replace(/&#\d+;/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\[x\]\s*/gi, '').replace(/\[ \]\s*/gi, '')
        .replace(/\*+/g, '').replace(/ㄴ/g, '')
        .replace(/✔/g, '').replace(/⇒/g, '→')
        .replace(/\n{2,}/g, '\n').trim()

    // 모든 일별 업무를 줄 단위로 파싱
    const allLines: string[] = []
    for (const entry of dailyEntries) {
      const cleaned = cleanContent(entry.content)
      const lines = cleaned.split('\n')
        .map(l => l.replace(/^\d{6}\s*/, '').replace(/^[-•\s]+/, '').trim())
        .filter(l => l.length >= 3)
        // 날짜행, 회고, 감상 등 제외
        .filter(l => !/^\d{2,4}[\.\-\/]?\d{0,2}[\.\-\/]?\d{0,2}/.test(l))
        .filter(l => !/^<(업무|회고)>/.test(l))
        .filter(l => !l.startsWith('✔'))
      allLines.push(...lines)
    }

    // 프로젝트/카테고리별 그룹핑
    const categories: Record<string, Set<string>> = {}
    let currentCategory = '기타'

    // 알려진 프로젝트 키워드
    const PROJECT_KEYWORDS: [RegExp, string][] = [
      [/AX\s*프로젝트|부스터\s*AX|프론트\s*AX/i, 'AX 프로젝트'],
      [/위픽부스터\s*솔루션|솔루션/i, '위픽부스터 솔루션'],
      [/AI\s*바우처/i, 'AI 바우처'],
      [/랜딩\s*페이지|랜딩빌더/i, '랜딩페이지 빌더'],
      [/위픽업/i, '위픽업'],
      [/위픽레터|레터/i, '위픽레터'],
      [/구독(형|솔루션|모델|제)/i, '구독솔루션'],
      [/CRM|알림톡|SMS/i, 'CRM/알림톡'],
    ]

    // 회의 패턴
    const MEETING_RE = /회의|미팅|스프린트/

    const meetings: string[] = []
    const routines: string[] = []

    for (const line of allLines) {
      // 회의 감지
      if (MEETING_RE.test(line) && line.length < 80) {
        const meetingName = line.replace(/\(완료\)|\(참석\)/g, '').replace(/\d{1,2}:\d{2}[~\-]\s*\d{0,2}:?\d{0,2}\s*/g, '').trim()
        if (meetingName.length >= 3 && !meetings.includes(meetingName)) {
          meetings.push(meetingName)
        }
        continue
      }

      // 루틴 감지
      if (/관리지표|리드수\s*입력|리포팅|누락\s*리드|상품등록|문의답변/.test(line)) {
        const routine = line.replace(/\(완료\)|\(완\)/g, '').trim()
        if (routine.length >= 3 && !routines.includes(routine)) {
          routines.push(routine)
        }
        continue
      }

      // 프로젝트 카테고리 감지
      let matched = false
      for (const [re, cat] of PROJECT_KEYWORDS) {
        if (re.test(line)) {
          currentCategory = cat
          // 카테고리 헤더만 있는 줄은 건너뜀
          const stripped = line.replace(re, '').replace(/[\[\]]/g, '').trim()
          if (stripped.length >= 3) {
            if (!categories[currentCategory]) categories[currentCategory] = new Set()
            categories[currentCategory].add(stripped)
          }
          matched = true
          break
        }
      }

      if (!matched && line.length >= 5) {
        // 하위 항목 (- , ㄴ 등으로 시작하던 것들)
        if (!categories[currentCategory]) categories[currentCategory] = new Set()
        // 상태 표시 제거
        const clean = line
          .replace(/\(완료\)|\(완\)|\(배포완료\)|\(배포대기\)|\(진행중\)|\(계속\)/g, '')
          .replace(/^\[v\]\s*/i, '')
          .trim()
        if (clean.length >= 3) {
          categories[currentCategory].add(clean)
        }
      }
    }

    // 결과 조합
    const result: string[] = []

    for (const [cat, items] of Object.entries(categories)) {
      if (cat === '기타' && items.size === 0) continue
      const itemList = Array.from(items).slice(0, 8).join(', ')
      if (itemList) {
        result.push(`• ${cat}: ${itemList}`)
      }
    }

    if (routines.length > 0) {
      result.push(`• 루틴: ${routines.join(', ')}`)
    }

    if (meetings.length > 0) {
      result.push(`• 회의: ${meetings.join(', ')}`)
    }

    if (result.length === 0) {
      return dailyEntries.map((e) => `[${e.date}] ${cleanContent(e.content).slice(0, 200)}`).join('\n')
    }

    return result.join('\n')
  } catch (err) {
    console.error('Weekly summary error:', err)
    return dailyEntries.map((e) => e.content.replace(/<[^>]+>/g, '').slice(0, 100)).join('\n')
  }
}
