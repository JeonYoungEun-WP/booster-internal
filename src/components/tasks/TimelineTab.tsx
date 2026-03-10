'use client'

import { useState } from 'react'
import { useProjects } from '@/src/hooks/useProjects'
import { ProjectForm } from './ProjectForm'

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
  ON_HOLD: 'bg-yellow-500',
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function isWeekend(year: number, month: number, day: number) {
  const dow = new Date(year, month, day).getDay()
  return dow === 0 || dow === 6
}

export function TimelineTab() {
  const [showForm, setShowForm] = useState(false)
  const { projects, loading, error, createProject, deleteProject } = useProjects()

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const today = now.getDate()
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1)
      setViewMonth(11)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1)
      setViewMonth(0)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const goToday = () => {
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  // 프로젝트 막대 위치 계산
  function getBarRange(project: { startDate: string; endDate: string | null }) {
    const start = new Date(project.startDate)
    const end = project.endDate ? new Date(project.endDate) : now

    const monthStart = new Date(viewYear, viewMonth, 1)
    const monthEnd = new Date(viewYear, viewMonth, daysInMonth)

    if (end < monthStart || start > monthEnd) return null

    const startDay = start < monthStart ? 1 : start.getDate()
    const endDay = end > monthEnd ? daysInMonth : end.getDate()

    return { startDay, endDay }
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">TIMELINE</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            + 프로젝트 추가
          </button>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="rounded border border-border px-2 py-1 text-sm hover:bg-muted/50">&lt;</button>
            <button onClick={goToday} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted/50">오늘</button>
            <button onClick={nextMonth} className="rounded border border-border px-2 py-1 text-sm hover:bg-muted/50">&gt;</button>
          </div>
        </div>
      </div>

      {showForm && (
        <ProjectForm
          onSubmit={async (data) => {
            await createProject(data)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600">오류: {error}</div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">데이터를 불러오는 중...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <div className="min-w-[900px]">
            {/* 월 타이틀 */}
            <div className="border-b border-border bg-muted/50 px-4 py-2">
              <span className="text-sm font-semibold">{viewYear}년 {viewMonth + 1}월</span>
            </div>

            {/* 일자 헤더 */}
            <div className="flex border-b border-border">
              <div className="w-40 shrink-0 border-r border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
                프로젝트명
              </div>
              <div className="flex flex-1">
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const weekend = isWeekend(viewYear, viewMonth, day)
                  const isToday = isCurrentMonth && day === today
                  return (
                    <div
                      key={day}
                      className={`flex-1 min-w-[28px] text-center text-xs py-1.5 border-r border-border last:border-r-0
                        ${weekend ? 'bg-muted/70 text-muted-foreground' : ''}
                        ${isToday ? 'bg-primary/10 font-bold text-primary' : ''}`}
                    >
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 프로젝트 행 */}
            {projects.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                등록된 프로젝트가 없습니다.
              </div>
            ) : (
              projects.map((project) => {
                const bar = getBarRange(project)
                return (
                  <div key={project.id} className="flex border-b border-border last:border-0 hover:bg-muted/20">
                    <div className="w-40 shrink-0 border-r border-border px-3 py-2 flex items-center gap-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[project.status]}`}
                        title={STATUS_LABELS[project.status]}
                      />
                      <span className="text-xs font-medium truncate" title={project.title}>
                        {project.title}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(`"${project.title}" 프로젝트를 삭제하시겠습니까?`)) {
                            deleteProject(project.id)
                          }
                        }}
                        className="ml-auto text-xs text-red-400 hover:text-red-600 shrink-0"
                        title="삭제"
                      >
                        x
                      </button>
                    </div>
                    <div className="flex flex-1 relative">
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1
                        const weekend = isWeekend(viewYear, viewMonth, day)
                        const isToday = isCurrentMonth && day === today
                        return (
                          <div
                            key={day}
                            className={`flex-1 min-w-[28px] border-r border-border last:border-r-0
                              ${weekend ? 'bg-muted/40' : ''}
                              ${isToday ? 'bg-primary/5' : ''}`}
                          />
                        )
                      })}
                      {/* 간트 바 */}
                      {bar && (
                        <div
                          className={`absolute top-1 bottom-1 rounded ${project.color ? '' : STATUS_COLORS[project.status]} opacity-70`}
                          style={{
                            left: `${((bar.startDay - 1) / daysInMonth) * 100}%`,
                            width: `${((bar.endDay - bar.startDay + 1) / daysInMonth) * 100}%`,
                            backgroundColor: project.color || undefined,
                          }}
                        />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
