import { cancelSession } from '@/app/utils/jobStore'

export const runtime = 'nodejs'

/**
 * Route: POST /api/prava/revoke
 *
 * Accepts a JSON payload with:
 * - sessionId (required)
 *
 * Validates input, marks the session as cancelled in the job store, and returns
 * confirmation payload: { ok: true, sessionId }.
 */
export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).sessionId !== 'string') {
    return Response.json({ error: 'Missing sessionId.' }, { status: 400 })
  }

  const sessionId = (body as Record<string, string>).sessionId
  cancelSession(sessionId)

  return Response.json({ ok: true, sessionId }, { status: 200 })
}
