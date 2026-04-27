'use client'

import { useState } from 'react'
import { filterVisibleMembers } from '@/src/lib/team'

const TEAM_OPTIONS = [
  { name: '전영은', email: 'youngeun@wepick.kr' },
  { name: '권상현', email: 'sanghyeon@wepick.kr' },
  { name: '이유림', email: 'youlim@wepick.kr' },
  { name: '이정하', email: 'jungha@wepick.kr' },
  { name: '이정주', email: 'jeongju@wepick.kr' },
  { name: '조희연', email: 'heeyeon@wepick.kr' },
  { name: '서청원', email: 'cheongwon@wepick.kr' },
]

interface DailyTaskFormProps {
  onSubmit: (data: { date: string; authorEmail: string; content: string }) => Promise<void>
  onCancel: () => void
}

export function DailyTaskForm({ onSubmit, onCancel }: DailyTaskFormProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [authorEmail, setAuthorEmail] = useState(TEAM_OPTIONS[0].email)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    try {
      await onSubmit({ date, authorEmail, content: content.trim() })
      setContent('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={authorEmail}
          onChange={(e) => setAuthorEmail(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        >
          {filterVisibleMembers(TEAM_OPTIONS, date).map((m) => (
            <option key={m.email} value={m.email}>{m.name}</option>
          ))}
        </select>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="업무 내용을 입력하세요..."
        rows={4}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-1.5 text-sm hover:bg-muted/50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}
