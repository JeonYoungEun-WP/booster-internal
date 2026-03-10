import { useState, useEffect, useCallback } from 'react'

interface DailyTask {
  id: string
  date: string
  authorEmail: string
  authorName: string
  content: string
  source: 'TEAMS' | 'MANUAL'
  createdAt: string
}

interface UseDailyTasksOptions {
  startDate?: string
  endDate?: string
  authorEmail?: string
}

export function useDailyTasks(options: UseDailyTasksOptions = {}) {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (options.startDate) params.set('startDate', options.startDate)
      if (options.endDate) params.set('endDate', options.endDate)
      if (options.authorEmail) params.set('authorEmail', options.authorEmail)

      const res = await fetch(`/api/tasks/daily?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setTasks(data.tasks)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [options.startDate, options.endDate, options.authorEmail])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = async (task: { date: string; authorEmail: string; content: string }) => {
    const res = await fetch('/api/tasks/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, source: 'MANUAL' }),
    })
    if (!res.ok) throw new Error('Failed to create')
    await fetchTasks()
  }

  const deleteTask = async (id: string) => {
    const res = await fetch(`/api/tasks/daily/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete')
    await fetchTasks()
  }

  return { tasks, loading, error, refetch: fetchTasks, createTask, deleteTask }
}
