import { clearEventLogs, eventLogger, getEventLogs } from '@/app/utils/eventLogger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ logs: getEventLogs(300) })
}

export async function DELETE() {
  clearEventLogs()
  return Response.json({ success: true })
}

type LogLevel = 'info' | 'warn' | 'error' | 'success'

function isLogLevel(value: unknown): value is LogLevel {
  return value === 'info' || value === 'warn' || value === 'error' || value === 'success'
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as Record<string, unknown>
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const payload = asRecord(body)
  const level = payload.level
  const message = payload.message
  const data = asRecord(payload.data)

  if (!isLogLevel(level) || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json(
      { error: 'Invalid payload. Required fields: level (info|warn|error|success), message (string).' },
      { status: 400 }
    )
  }

  const trimmedMessage = message.trim()
  eventLogger[level](trimmedMessage, data)

  console.log('[api/logs] client log', {
    level,
    message: trimmedMessage,
    data,
  })

  return Response.json({ ok: true }, { status: 200 })
}