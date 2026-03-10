import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { content, date } = body

    const task = await prisma.dailyTask.update({
      where: { id },
      data: {
        ...(content !== undefined && { content }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    })

    return NextResponse.json({ ok: true, task })
  } catch (error) {
    console.error('PUT /api/tasks/daily/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to update daily task' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.dailyTask.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/tasks/daily/[id] error:', error)
    return NextResponse.json(
      { error: 'Failed to delete daily task' },
      { status: 500 },
    )
  }
}
