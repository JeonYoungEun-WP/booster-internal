'use client'

import { useState, useEffect, useCallback } from 'react'

interface Project {
  id: string
  title: string
  description: string | null
  startDate: string
  endDate: string | null
  status: string
  color: string | null
  sortOrder: number
}

interface CreateProjectData {
  title: string
  description?: string
  startDate: string
  endDate?: string
  color?: string
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tasks/projects')
      if (!res.ok) throw new Error('조회 실패')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = useCallback(async (data: CreateProjectData) => {
    const res = await fetch('/api/tasks/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('생성 실패')
    await fetchProjects()
  }, [fetchProjects])

  const deleteProject = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('삭제 실패')
    await fetchProjects()
  }, [fetchProjects])

  return { projects, loading, error, createProject, deleteProject }
}
