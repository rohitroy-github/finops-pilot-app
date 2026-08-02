import type { EventLogEntry } from '@/app/utils/eventLogger'

export type LiveEventCard = {
  id: string
  dependency: string
  status: string
  receivedAt: string
}

export type PastEventCard = {
  id: string
  username: string
  dependency: string
  incidentStatus: string
  paymentAmount: number
  paymentStatus: string
  receivedAt: string
}

export type PravaSessionData = {
  sessionId?: string
  sessionToken?: string
  iframeUrl?: string
}

export type RevokeSessionResult = {
  ok?: boolean
  sessionId?: string
  error?: string
}

export type CancelPaymentSessionResult = {
  ok: boolean
  sessionId: string | null
  message: string
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString()
}

export function mergeEventLogs(
  current: EventLogEntry[],
  incoming: EventLogEntry[],
  maxItems = 120
): EventLogEntry[] {
  const map = new Map<string, EventLogEntry>()

  for (const log of current) {
    map.set(log.id, log)
  }

  for (const log of incoming) {
    map.set(log.id, log)
  }

  return Array.from(map.values())
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, maxItems)
}

export function deriveLiveEvents(logs: EventLogEntry[]): LiveEventCard[] {
  const plannerStart = logs.find((entry) => entry.data?.stage === 'planner_start')

  if (!plannerStart) {
    return []
  }

  const dependency =
    typeof plannerStart.data?.dependency === 'string'
      ? plannerStart.data.dependency
      : 'Unknown dependency'

  const hasPaymentSuccess = logs.some(
    (entry) =>
      entry.data?.stage === 'merchant_payment_complete' &&
      typeof entry.data?.outcome === 'string' &&
      entry.data.outcome === 'success'
  )

  const hasWaitingApproval = logs.some(
    (entry) => entry.data?.stage === 'merchant_payment_waiting_approval'
  )

  const hasProcessing = logs.some(
    (entry) =>
      entry.data?.stage === 'merchant_payment_processing' ||
      entry.data?.stage === 'merchant_payment_start'
  )

  let status = 'Processing'
  if (hasPaymentSuccess) {
    status = 'Payment successful'
  } else if (hasWaitingApproval) {
    status = 'Waiting for approval'
  } else if (hasProcessing) {
    status = 'Processing'
  }

  const latestLifecycleEntry =
    logs.find((entry) => entry.data?.stage === 'merchant_payment_complete') ??
    logs.find((entry) => entry.data?.stage === 'merchant_payment_waiting_approval') ??
    logs.find((entry) => entry.data?.stage === 'merchant_payment_processing') ??
    plannerStart

  return [
    {
      id: plannerStart.id,
      dependency,
      status,
      receivedAt: latestLifecycleEntry.ts,
    },
  ]
}

export async function fetchPravaSession(): Promise<PravaSessionData | null> {
  try {
    const response = await fetch('/api/prava/session', {
      method: 'POST',
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as PravaSessionData
  } catch {
    return null
  }
}

export async function fetchLogSnapshot(): Promise<EventLogEntry[] | null> {
  try {
    const response = await fetch('/api/logs', { cache: 'no-store' })
    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { logs?: EventLogEntry[] }
    return Array.isArray(data.logs) ? data.logs : []
  } catch {
    return null
  }
}

export async function fetchPastEventsByUsername(
  username: string
): Promise<PastEventCard[] | null> {
  const normalizedUsername = username.trim()
  if (!normalizedUsername) {
    return []
  }

  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: normalizedUsername, limit: 20 }),
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as { events?: PastEventCard[] }
    return Array.isArray(data.events) ? data.events : []
  } catch {
    return null
  }
}

export async function revokePravaSessionRequest(
  sessionId: string
): Promise<RevokeSessionResult> {
  const response = await fetch('/api/prava/revoke', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to revoke Prava session')
  }

  return (await response.json()) as RevokeSessionResult
}

export async function cancelPaymentSession(
  sessionId: string | null
): Promise<CancelPaymentSessionResult> {
  if (!sessionId) {
    return {
      ok: false,
      sessionId: null,
      message: 'Session id is not available yet.',
    }
  }

  try {
    await revokePravaSessionRequest(sessionId)
  } catch {
    // Best-effort: continue local cleanup even if revoke fails.
  }

  return {
    ok: true,
    sessionId,
    message: 'Payment session manually cancelled.',
  }
}
