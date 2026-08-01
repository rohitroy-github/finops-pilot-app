import { listJobs } from '@/app/utils/jobStore'

export const runtime = 'nodejs'

export async function POST() {
  const jobs = listJobs()
  const latestJob = jobs.at(-1)

  if (!latestJob) {
    return Response.json(
      { error: 'No planner job found. Trigger planner once before collecting card details.' },
      { status: 400 }
    )
  }

  if (latestJob.pravaSession?.sessionToken && latestJob.pravaSession.iframeUrl) {
    return Response.json(
      {
        sessionId: latestJob.pravaSession.sessionId,
        sessionToken: latestJob.pravaSession.sessionToken,
        iframeUrl: latestJob.pravaSession.iframeUrl,
      },
      { status: 200 }
    )
  }

  return Response.json(
    {
      error:
        latestJob.pravaSessionError ||
        'Prava session is not available yet. Trigger planner and wait for session creation.',
    },
    { status: 409 }
  )
}