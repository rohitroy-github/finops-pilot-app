import { EventEmitter } from 'node:events'

type LogLevel = 'info' | 'warn' | 'error' | 'success'

export type EventLogEntry = {
  id: string
  ts: string
  level: LogLevel
  message: string
  data?: Record<string, unknown>
}

const MAX_LOGS = 500

class EventLogger extends EventEmitter {
  private logs: EventLogEntry[] = []

  constructor() {
    super()
    // 0 = unlimited listeners (prevents artificial cap for SSE clients)
    this.setMaxListeners(0)
  }

  private write(level: LogLevel, message: string, data: Record<string, unknown> = {}): EventLogEntry {
    const entry: EventLogEntry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      level,
      message,
      data,
    }

    this.logs.push(entry)
    if (this.logs.length > MAX_LOGS) {
      this.logs.shift()
    }

    this.emit('log', entry)
    return entry
  }

  info(message: string, data?: Record<string, unknown>) {
    return this.write('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>) {
    return this.write('warn', message, data)
  }

  error(message: string, data?: Record<string, unknown>) {
    return this.write('error', message, data)
  }

  success(message: string, data?: Record<string, unknown>) {
    return this.write('success', message, data)
  }

  recent(n = 500): EventLogEntry[] {
    return this.logs.slice(-n)
  }

  clear() {
    this.logs = []
    this.emit('clear')
  }
}

export const eventLogger = new EventLogger()

export function getEventLogs(limit = 500): EventLogEntry[] {
  return eventLogger.recent(limit)
}

export function subscribeToEventLogs(
  onLog: (entry: EventLogEntry) => void,
  onClear?: () => void
): () => void {
  eventLogger.on('log', onLog)
  if (onClear) eventLogger.on('clear', onClear)

  return () => {
    eventLogger.off('log', onLog)
    if (onClear) eventLogger.off('clear', onClear)
  }
}

export function clearEventLogs() {
  eventLogger.clear()
}