'use client'

import { useState } from 'react'
import { useDailyTasks } from '@/src/hooks/useDailyTasks'
import { DailyTaskForm } from './DailyTaskForm'

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

function getKSTDate(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${dateStr} (${days[d.getDay()]})`
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function DailyTaskTab() {
  const [startDate, setStartDate] = useState(getKSTDate(-6))
  const [endDate, setEndDate] = useState(getKSTDate())
  const [filterEmail, setFilterEmail] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const { tasks, loading, error, refetch, createTask, updateTask, deleteTask } = useDailyTasks({
    startDate,
    endDate,
    authorEmail: filterEmail || undefined,
  })

  // 날짜별로 그룹핑
  const grouped = tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
    const date = task.date.slice(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(task)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const startEditing = (task: { id: string; content: string }) => {
    setEditingId(task.id)
    setEditContent(task.content.includes('<') ? htmlToPlainText(task.content) : task.content)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditContent('')
  }

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return
    await updateTask(id, editContent)
    setEditingId(null)
    setEditContent('')
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          <span className="text-muted-foreground">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
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
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          + 업무 추가
        </button>
      </div>

      {/* 수동 입력 폼 */}
      {showForm && (
        <DailyTaskForm
          onSubmit={async (data) => {
            await createTask(data)
            setShowForm(false)
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600">
          오류: {error}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          데이터를 불러오는 중...
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          데일리 업무 데이터가 없습니다.
        </div>
      ) : (
        /* 일자별 카드 */
        sortedDates.map((date) => (
          <div key={date} className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/50 px-4 py-2">
              <h3 className="text-sm font-semibold">{formatDateLabel(date)}</h3>
            </div>
            <div className="divide-y divide-border">
              {grouped[date].map((task) => (
                <div key={task.id} className="flex items-start gap-4 px-4 py-3">
                  <div className="w-16 shrink-0">
                    <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                      {task.authorName}
                    </span>
                  </div>
                  {editingId === task.id ? (
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-sans"
                        rows={Math.max(5, editContent.split('\n').length + 1)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(task.id)}
                          className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                        >
                          저장
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : task.content.includes('<') ? (
                    <div
                      className="flex-1 text-sm teams-content"
                      dangerouslySetInnerHTML={{ __html: task.content }}
                    />
                  ) : (
                    <div className="flex-1 text-sm whitespace-pre-wrap">{task.content}</div>
                  )}
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {task.source === 'TEAMS' ? 'Teams' : '수동'}
                    </span>
                    {editingId !== task.id && (
                      <button
                        onClick={() => startEditing(task)}
                        className="text-xs text-primary hover:underline"
                      >
                        수정
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('삭제하시겠습니까?')) deleteTask(task.id)
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {!loading && (
        <div className="text-center text-xs text-muted-foreground">
          총 {tasks.length}건
          <button onClick={refetch} className="ml-2 text-primary hover:underline">새로고침</button>
        </div>
      )}
    </div>
  )
}
