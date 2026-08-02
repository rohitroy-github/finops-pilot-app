import { randomUUID } from 'node:crypto'

import type { ResultSetHeader } from 'mysql2'

import { query } from '@/app/lib/db'

type JobInput = {
  event: Record<string, unknown>
  purchasePlan: unknown
}

type PurchasePlanRecord = {
  exactCost?: number | string
}

type JobPravaSession = {
  sessionId?: string
  sessionToken?: string
  iframeUrl?: string
}

type FinalPaymentStatus = 'pending' | 'success' | 'failed' | 'submitted' | 'cancelled' | 'timeout' | 'skipped_dev_mode'| 'skipped'

export type PlannerJob = JobInput & {
  id: string
  createdAt: string
  pravaSession?: JobPravaSession
  pravaSessionError?: string
}

const jobs: PlannerJob[] = []
const cancelledSessions = new Set<string>()

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function derivePravaUserId(username?: string, clientToken?: string): string | undefined {
  const normalizedClientToken = readString(clientToken)
  if (normalizedClientToken?.endsWith('_clienttoken')) {
    return normalizedClientToken.slice(0, -'_clienttoken'.length)
  }

  const normalizedUsername = readString(username)
  if (!normalizedUsername) {
    return undefined
  }

  return `finops_pilot_user_${normalizedUsername}`
}

function readPaymentAmount(purchasePlan: unknown): number {
  const exactCost = (purchasePlan as PurchasePlanRecord | undefined)?.exactCost       
  const numeric = typeof exactCost === 'number' ? exactCost : Number.parseFloat(String(exactCost ?? '0'))
  return Number.isFinite(numeric) ? numeric : 0
}

async function insertEventRow(job: PlannerJob): Promise<void> {
  const username =
    readString(job.event.client_username) ??
    process.env.DEMO_PRAVA_SESSION_USER_ID ??
    'user_finops_pilot'
  const clientToken = readString(job.event.client_token)
  const pravaUserId =
    derivePravaUserId(username, clientToken) ??
    `finops_pilot_user_${username}`
  const merchantName =
    readString(job.event.dependency_merchant) ??
    'unknown_merchant'
  const merchantStatus =
    readString(job.event.dependency_working_status) ??
    'unknown'
  const merchantPricingUrl =
    readString(job.event.merchant_billing_url) ??
    readString(job.event.billing_url) ??
    ''

  await query<ResultSetHeader>(
    `
      INSERT INTO events (
        username,
        prava_user_id,
        inc_merchant_name,
        inc_merchant_status,
        inc_merchant_pricing_url,
        payment_amount,
        agent_job_id,
        agent_final_payment_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      username,
      pravaUserId,
      merchantName,
      merchantStatus,
      merchantPricingUrl,
      readPaymentAmount(job.purchasePlan),
      job.id,
      'pending',
    ]
  )
}

export function cancelSession(sessionId: string): void {
  cancelledSessions.add(sessionId)
}

export function isSessionCancelled(sessionId: string): boolean {
  return cancelledSessions.has(sessionId)
}

export async function createJob(input: JobInput): Promise<PlannerJob> {
  console.log('[createJob] in', {
    hasEvent: Boolean(input.event),
    hasPurchasePlan: Boolean(input.purchasePlan),
  })

  const job: PlannerJob = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  }

  jobs.push(job)
  await insertEventRow(job)
  console.log('[createJob] out', { jobId: job.id, totalJobs: jobs.length })
  return job
}

export function listJobs(): PlannerJob[] {
  return jobs
}

export async function updateJobPravaSession(
  jobId: string,
  pravaSession?: JobPravaSession,
  pravaSessionError?: string
): Promise<PlannerJob | undefined> {
  const job = jobs.find((item) => item.id === jobId)
  if (!job) {
    return undefined
  }

  job.pravaSession = pravaSession
  job.pravaSessionError = pravaSessionError

  await query<ResultSetHeader>(
    `
      UPDATE events
      SET prava_session_id = ?
      WHERE agent_job_id = ?
    `,
    [pravaSession?.sessionId ?? null, jobId]
  )

  return job
}

export async function updateJobFinalPaymentStatus(
  jobId: string,
  status: FinalPaymentStatus
): Promise<void> {
  await query<ResultSetHeader>(
    `
      UPDATE events
      SET agent_final_payment_status = ?
      WHERE agent_job_id = ?
    `,
    [status, jobId]
  )
}
