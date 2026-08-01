import {
  getEventLogs,
  subscribeToEventLogs,
  type EventLogEntry,
} from '@/app/utils/eventLogger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatSse(data: unknown, event?: string): string {
  const eventLine = event ? `event: ${event}\n` : ''
  return `${eventLine}data: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Stream already closed or canceled by browser
        }
      }

      // 1. Initial Handshake Comment
      send(': finops-pilot-log-stream\n\n')

      // 2. Register live listener FIRST to prevent missing concurrent logs
      const seenIds = new Set<string>()

      const unsubscribe = subscribeToEventLogs(
        (entry) => {
          if (!seenIds.has(entry.id)) {
            seenIds.add(entry.id)
            send(formatSse(entry))
          }
        },
        () => {
          // Send an explicit clear event to the UI if logs are cleared server-side
          send(formatSse({ action: 'clear' }, 'control'))
        }
      )

      // 3. Backfill existing past logs
      for (const entry of getEventLogs()) {
        if (!seenIds.has(entry.id)) {
          seenIds.add(entry.id)
          send(formatSse(entry))
        }
      }

      // 4. Heartbeat ping (keeps proxies like NGINX/Cloudflare alive)
      const heartbeat = setInterval(() => {
        send(': keepalive\n\n')
      }, 15_000)

      // 5. Cleanup when the connection aborts or finishes
      const cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }

      request.signal.addEventListener('abort', cleanup, { once: true })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Pragma: 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}