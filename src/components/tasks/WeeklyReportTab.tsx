'use client'

import { useState } from 'react'
import { useWeeklyReports } from '@/src/hooks/useWeeklyReports'

const TEAM_MEMBERS = [
  { name: '전체', email: '' },
  { name: '전영은', email: 'youngeun@wepick.kr' },
  { name: '권상현', email: 'sanghyeon@wepick.kr' },
  { name: '이유림', email: 'youlim@wepick.kr' },
  { name: '이정하', email: 'jungha@wepick.kr' },
  { name: '이정주', email: 'jeongju@wepick.kr' },
  { name: '조희연', email: 'heeyeon@wepick.kr' },
]

function getWeekLabel(dateStr: string) {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
  const week = Math.ceil((d.getDate() + firstDay.getDay()) / 7)
  return `${month}월 ${week - 1}주`
}

function formatDate(dateStr: string) {
  return dateStr.slice(0, 10).replace(/-/g, '/')
}

function getThisMonday() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().slice(0, 10)
}

export function WeeklyReportTab() {
  const [filterEmail, setFilterEmail] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planEmail, setPlanEmail] = useState(TEAM_MEMBERS[1].email)
  const [planText, setPlanText] = useState('')
  const [generating, setGenerating] = useState(false)

  const { reports, loading, error, savePlan, generateSummary } = useWeeklyReports(
    filterEmail || undefined,
  )

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
    const weekStart = getThisMonday()
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
          onClick={() => setShowPlanForm(!showPlanForm)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + 이번주 계획 입력
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
          <div className="flex gap-3">
            <select
              value={planEmail}
              onChange={(e) => setPlanEmail(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            >
              {TEAM_MEMBERS.filter((m) => m.email).map((m) => (
                <option key={m.email} value={m.email}>{m.name}</option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground leading-8">
              이번주 ({getThisMonday()})
            </span>
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
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium w-10">#</th>
                <th className="px-3 py-2 text-left font-medium min-w-[80px]">주차구분</th>
                <th className="px-3 py-2 text-left font-medium min-w-[90px]">지난주(월)</th>
                <th className="px-3 py-2 text-left font-medium min-w-[250px]">지난주 한 일</th>
                <th className="px-3 py-2 text-left font-medium min-w-[90px]">이번주(월)</th>
                <th className="px-3 py-2 text-left font-medium min-w-[250px]">이번주 할 일</th>
                <th className="px-3 py-2 text-left font-medium min-w-[70px]">작성자</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    주간 보고 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                reports.map((r, idx) => {
                  const weekStartDate = r.weekStart.slice(0, 10)
                  const prevMonday = new Date(weekStartDate)
                  prevMonday.setDate(prevMonday.getDate() - 7)
                  const prevMondayStr = prevMonday.toISOString().slice(0, 10)

                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">{reports.length - idx}</td>
                      <td className="px-3 py-2 font-medium">{getWeekLabel(weekStartDate)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(prevMondayStr)}</td>
                      <td className="px-3 py-2 whitespace-pre-wrap">
                        {r.weeklySummary || (
                          <span className="text-muted-foreground italic">AI 요약 대기중</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(weekStartDate)}</td>
                      <td className="px-3 py-2">
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
                            className="cursor-pointer whitespace-pre-wrap hover:bg-muted/50 rounded p-1 -m-1"
                            onClick={() => {
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
                      <td className="px-3 py-2">{r.authorName}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
