'use client'

import { useState } from 'react'
import { DailyTaskTab } from '@/src/components/tasks/DailyTaskTab'
import { WeeklyReportTab } from '@/src/components/tasks/WeeklyReportTab'
import { TimelineTab } from '@/src/components/tasks/TimelineTab'

const TABS = [
  { id: 'daily', label: '데일리 업무' },
  { id: 'weekly', label: '주간 보고' },
  { id: 'timeline', label: '타임라인' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function TasksPage() {
  const [activeTab, setActiveTab] = useState<TabId>('weekly')

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-2xl font-bold">업무 관리</h1>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === 'daily' && <DailyTaskTab />}
        {activeTab === 'weekly' && <WeeklyReportTab />}
        {activeTab === 'timeline' && <TimelineTab />}
      </div>
    </div>
  )
}
