import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const activities = await prisma.projectActivity.findMany({
      where: { projectId: id },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ activities })
  } catch (error) {
    console.error('GET /api/tasks/projects/[id]/activities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 },
    )
  }
}
