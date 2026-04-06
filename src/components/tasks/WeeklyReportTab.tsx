'use client'

import { useState, useMemo, useEffect } from 'react'
import { useWeeklyReports } from '@/src/hooks/useWeeklyReports'

const TEAM_MEMBERS = [
  { name: '전체', email: '' },
  { name: '전영은', email: 'youngeun@wepick.kr' },
  { name: '권상현', email: 'sanghyeon@wepick.kr' },
  { name: '이유림', email: 'youlim@wepick.kr' },
  { name: '이정하', email: 'jungha@wepick.kr' },
  { name: '이정주', email: 'jeongju@wepick.kr' },
  { name: '조희연', email: 'heeyeon@wepick.kr' },
  { name: '서청원', email: 'cheongwon@wepick.kr' },
]

// ISO 8601 기준: 해당 주의 목요일이 속한 월이 기준, 그 월의 첫 번째 목요일이 1주차
function getWeekOfMonth(dateStr: string) {
  const d = new Date(dateStr)
  // 해당 주의 목요일 구하기 (월요일 기준 weekStart + 3)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + diffToMon + 3)

  const month = thursday.getMonth() + 1
  // 목요일이 속한 달의 첫 번째 목요일 찾기
  const firstOfThuMonth = new Date(thursday.getFullYear(), thursday.getMonth(), 1)
  let firstThursday = new Date(firstOfThuMonth)
  const thuDow = firstOfThuMonth.getDay()
  // 목요일(4)까지의 오프셋
  const offset = thuDow <= 4 ? 4 - thuDow : 11 - thuDow
  firstThursday.setDate(firstOfThuMonth.getDate() + offset)

  const week = Math.floor((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return { month, week }
}

function getWeekLabel(dateStr: string) {
  const { month, week } = getWeekOfMonth(dateStr)
  return `${month}월 ${week}주`
}

function getWeekShortLabel(dateStr: string) {
  const { month, week } = getWeekOfMonth(dateStr)
  return `${month}M${week}W`
}

function formatDate(dateStr: string) {
  return dateStr.slice(0, 10).replace(/-/g, '/')
}

function getKSTNow() {
  // KST = UTC+9
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
}

function getThisMonday() {
  const kst = getKSTNow()
  const day = kst.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(kst)
  monday.setUTCDate(kst.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

function getNextMonday() {
  const base = new Date(getThisMonday())
  base.setDate(base.getDate() + 7)
  return base.toISOString().slice(0, 10)
}

// 금요일 00:00 KST 이후(금/토/일)면 다음 주 모드
function isAfterFridayKST() {
  const day = getKSTNow().getUTCDay()
  return day === 5 || day === 6 || day === 0
}

// 계획 항목이 결과에 포함되었는지 키워드 매칭으로 판단
function checkPlanCompletion(planText: string, summaryText: string | null): { line: string; done: boolean }[] {
  if (!planText) return []
  const summary = (summaryText || '').toLowerCase()
  const lines = planText.split('\n').filter(l => l.trim())

  return lines.map(line => {
    const cleaned = line.replace(/^[-•*ㄴ\s]+/, '').trim()
    if (!cleaned || cleaned.length < 3) return { line, done: true } // 너무 짧은 줄은 무시

    // 핵심 키워드 추출 (2글자 이상 단어)
    const keywords = cleaned
      .replace(/[()[\]~→·:,./]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)
      .slice(0, 5) // 상위 5개 키워드만

    if (keywords.length === 0) return { line, done: true }

    // 키워드 중 절반 이상이 결과에 포함되면 완료로 판정
    const matchCount = keywords.filter(kw => summary.includes(kw.toLowerCase())).length
    const done = matchCount >= Math.max(1, Math.ceil(keywords.length * 0.4))
    return { line, done }
  })
}

export function WeeklyReportTab() {
  const [filterEmail, setFilterEmail] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planEmail, setPlanEmail] = useState(TEAM_MEMBERS[1].email)
  const [planText, setPlanText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [targetWeek, setTargetWeek] = useState<'this' | 'next'>(() =>
    isAfterFridayKST() ? 'next' : 'this'
  )

  const { reports, loading, error, savePlan, generateSummary } = useWeeklyReports(
    filterEmail || undefined,
  )

  // 주차별 그룹핑
  const weekGroups = useMemo(() => {
    const groups: Record<string, typeof reports> = {}
    for (const r of reports) {
      const weekKey = r.weekStart.slice(0, 10)
      if (!groups[weekKey]) groups[weekKey] = []
      groups[weekKey].push(r)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [reports])

  // 페이지네이션 (1페이지 = 1주) — 금요일 KST 이후면 다음 주 기본
  const [weekPage, setWeekPage] = useState(0)
  const activeMonday = isAfterFridayKST() ? getNextMonday() : getThisMonday()

  // 데이터 로드 후 activeMonday에 해당하는 주차로 자동 이동
  useEffect(() => {
    if (weekGroups.length === 0) return
    const idx = weekGroups.findIndex(([w]) => w === activeMonday)
    setWeekPage(idx >= 0 ? idx : 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekGroups.length])
  const totalWeekPages = weekGroups.length
  const currentWeekRaw = weekGroups[weekPage]

  // 현재 주에 레코드가 없는 팀원도 포함 (필터 적용 시 제외)
  const currentWeek = useMemo(() => {
    if (!currentWeekRaw) return null
    const [weekKey, existingReports] = currentWeekRaw
    const allMembers = TEAM_MEMBERS.filter(m => m.email)
      .filter(m => !filterEmail || m.email === filterEmail)
    const merged = allMembers.map(m => {
      const existing = existingReports.find(r => r.authorEmail === m.email)
      return existing || {
        id: `placeholder-${m.email}-${weekKey}`,
        weekStart: weekKey,
        authorEmail: m.email,
        authorName: m.name,
        weeklyPlan: null,
        weeklySummary: null,
        summaryGeneratedAt: null,
      }
    })
    return [weekKey, merged] as [string, typeof reports]
  }, [currentWeekRaw, filterEmail])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateSummary()
    } catch (err) {
      alert('AI 요약 생성 실패: ' + (err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSavePlan = async () => {
    if (!planText.trim()) return
    const weekStart = targetWeek === 'next' ? getNextMonday() : getThisMonday()
    await savePlan(weekStart, planEmail, planText.trim())
    setPlanText('')
    setShowPlanForm(false)
  }

  const handleEditSave = async (id: string, weekStart: string, email: string) => {
    await savePlan(weekStart, email, editText.trim())
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="space-y-4">
      {/* 필터 + 입력 버튼 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          {TEAM_MEMBERS.map((m) => (
            <option key={m.email} value={m.email}>{m.name}</option>
          ))}
        </select>
        <button
          onClick={() => { setTargetWeek(isAfterFridayKST() ? 'next' : 'this'); setShowPlanForm(!showPlanForm) }}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + {isAfterFridayKST() ? '다음 주' : '이번 주'} 계획 입력
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-50"
        >
          {generating ? 'AI 요약 생성 중...' : 'AI 주간 요약 생성'}
        </button>
      </div>

      {/* 계획 입력 폼 */}
      {showPlanForm && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={planEmail}
              onChange={(e) => setPlanEmail(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {TEAM_MEMBERS.filter((m) => m.email).map((m) => (
                <option key={m.email} value={m.email}>{m.name}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                onClick={() => setTargetWeek('this')}
                className={`px-3 py-1.5 ${targetWeek === 'this' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}
              >
                이번 주 ({getThisMonday()})
              </button>
              <button
                onClick={() => setTargetWeek('next')}
                className={`px-3 py-1.5 border-l border-border ${targetWeek === 'next' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}
              >
                다음 주 ({getNextMonday()})
              </button>
            </div>
          </div>
          <textarea
            value={planText}
            onChange={(e) => setPlanText(e.target.value)}
            placeholder="이번주 업무 계획을 입력하세요..."
            rows={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowPlanForm(false)} className="rounded-lg border border-border px-4 py-1.5 text-sm hover:bg-muted/50">취소</button>
            <button onClick={handleSavePlan} disabled={!planText.trim()} className="rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">저장</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600">오류: {error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">데이터를 불러오는 중...</div>
      ) : !currentWeek ? (
        <div className="py-10 text-center text-sm text-muted-foreground">주간 보고 데이터가 없습니다.</div>
      ) : (
        <>
          {/* 주차 선택 + 이전/다음 */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setWeekPage((p) => Math.min(totalWeekPages - 1, p + 1))}
              disabled={weekPage >= totalWeekPages - 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-40"
            >
              ← 이전 주
            </button>
            <select
              value={weekPage}
              onChange={(e) => setWeekPage(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {weekGroups.map(([weekStart], idx) => (
                <option key={weekStart} value={idx}>
                  {getWeekLabel(weekStart)} ({formatDate(weekStart)})
                </option>
              ))}
            </select>
            <button
              onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
              disabled={weekPage <= 0}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50 disabled:opacity-40"
            >
              다음 주 →
            </button>
          </div>

          {/* 테이블 (행열 전환: 멤버가 열, 이번주/지난주가 행) */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium w-[120px]"></th>
                  {currentWeek[1].map((r) => (
                    <th key={r.id} className="px-3 py-2 text-center font-medium">
                      {r.authorName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* 이번 주 계획 */}
                <tr className="border-b border-border align-top">
                  <td className="px-3 py-2 font-medium bg-muted/30 whitespace-nowrap">
                    <div>이번 주 계획</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">
                      {formatDate(currentWeek[0])}
                    </div>
                  </td>
                  {currentWeek[1].map((r) => {
                    const weekStartDate = r.weekStart.slice(0, 10)
                    const isPlaceholder = r.id.startsWith('placeholder-')
                    return (
                      <td key={r.id} className="px-3 py-2">
                        {editingId === r.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows={4}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-sm resize-none"
                            />
                            <div className="flex gap-1">
                              <button onClick={() => handleEditSave(r.id, weekStartDate, r.authorEmail)} className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">저장</button>
                              <button onClick={() => setEditingId(null)} className="rounded border border-border px-2 py-0.5 text-xs">취소</button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="cursor-pointer whitespace-pre-wrap hover:bg-muted/50 rounded p-1 -m-1 text-sm"
                            onClick={async () => {
                              if (isPlaceholder) {
                                // placeholder면 먼저 DB에 레코드 생성
                                await savePlan(weekStartDate, r.authorEmail, '')
                                return // savePlan이 fetchReports를 호출하므로 리렌더링됨
                              }
                              setEditingId(r.id)
                              setEditText(r.weeklyPlan || '')
                            }}
                          >
                            {r.weeklyPlan || (
                              <span className="text-muted-foreground italic">클릭하여 입력</span>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
                {/* 지난 주 계획 */}
                <tr className="border-b border-border align-top">
                  <td className="px-3 py-2 font-medium bg-muted/30 whitespace-nowrap">
                    <div>지난 주 계획</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">
                      {(() => {
                        const prevMonday = new Date(currentWeek[0])
                        prevMonday.setDate(prevMonday.getDate() - 7)
                        return formatDate(prevMonday.toISOString())
                      })()}
                    </div>
                  </td>
                  {currentWeek[1].map((r) => {
                    // 이전 주 데이터에서 같은 팀원의 weeklyPlan과 weeklySummary 가져오기
                    const prevWeekGroup = weekGroups[weekPage + 1]
                    const prevReport = prevWeekGroup
                      ? prevWeekGroup[1].find((pr) => pr.authorEmail === r.authorEmail)
                      : null
                    const prevPlan = prevReport?.weeklyPlan || null
                    const prevSummary = r.weeklySummary || null
                    const planCheck = prevPlan ? checkPlanCompletion(prevPlan, prevSummary) : []
                    return (
                      <td key={`prev-plan-${r.id}`} className="px-3 py-2 text-sm">
                        {planCheck.length > 0 ? (
                          <div className="space-y-0.5">
                            {planCheck.map((item, i) => (
                              <div key={i} className="flex items-start gap-1">
                                <span className="whitespace-pre-wrap flex-1">{item.line}</span>
                                {!item.done && (
                                  <span className="shrink-0 text-red-500 font-bold text-xs mt-0.5">X</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">계획 없음</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
                {/* 지난 주 결과 */}
                <tr className="align-top">
                  <td className="px-3 py-2 font-medium bg-muted/30 whitespace-nowrap">
                    <div>지난 주 결과</div>
                    <div className="text-xs font-normal text-muted-foreground mt-0.5">
                      {(() => {
                        const prevMonday = new Date(currentWeek[0])
                        prevMonday.setDate(prevMonday.getDate() - 7)
                        return formatDate(prevMonday.toISOString())
                      })()}
                    </div>
                  </td>
                  {currentWeek[1].map((r) => (
                    <td key={`summary-${r.id}`} className="px-3 py-2 whitespace-pre-wrap text-sm">
                      {r.weeklySummary || (
                        <span className="text-muted-foreground italic">AI 요약 대기중</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

        </>
      )}
    </div>
  )
}
