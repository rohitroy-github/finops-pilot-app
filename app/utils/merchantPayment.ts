export type MerchantPaymentSelectors = {
  tokenInput: string
  cvvInput: string
  payButton: string
  cardholderNameInput?: string
  expiryInput?: string
  expiryMonthInput?: string
  expiryYearInput?: string
  successSelector?: string
  failureSelector?: string
}

export type MerchantPaymentBody = {
  merchantCheckoutUrl: string
  selectors: MerchantPaymentSelectors
  sessionId?: string
  customer_name?: string
  credentials?: {
    token: string
    dynamicCvv: string
    expiryMonth?: string
    expiryYear?: string
  }
  navigationTimeoutMs?: number
}

export type AutomationCredentials = {
  sessionId?: string
  orderId?: string
  txnId?: string
  status?: string
  token: string
  dynamicCvv: string
  expiryMonth?: string
  expiryYear?: string
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as Record<string, unknown>
}

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function hasSelectors(value: unknown): value is MerchantPaymentSelectors {
  if (!value || typeof value !== 'object') {
    return false
  }

  const selectors = value as Record<string, unknown>

  return Boolean(
    asNonEmptyString(selectors.tokenInput) &&
      asNonEmptyString(selectors.cvvInput) &&
      asNonEmptyString(selectors.payButton)
  )
}

export function isMerchantPaymentBody(value: unknown): value is MerchantPaymentBody {
  if (!value || typeof value !== 'object') {
    return false
  }

  const body = value as Record<string, unknown>
  return Boolean(asNonEmptyString(body.merchantCheckoutUrl) && hasSelectors(body.selectors))
}

export function parseAutomationCredentials(result: Record<string, unknown>): AutomationCredentials | null {
  const sessionId = asNonEmptyString(result.session_id)
  const orderId = asNonEmptyString(result.order_id)
  const status = asNonEmptyString(result.status)

  const transactions = Array.isArray(result.transactions) ? result.transactions : []
  const firstTxn = asRecord(transactions[0])
  const txnId = asNonEmptyString(firstTxn.txn_id)

  const lineItems = Array.isArray(firstTxn.line_items) ? firstTxn.line_items : []
  const firstLineItem = asRecord(lineItems[0])

  const token = asNonEmptyString(firstLineItem.token)
  const dynamicCvv = asNonEmptyString(firstLineItem.dynamic_cvv)

  if (!token || !dynamicCvv) {
    console.warn('[merchant-payment/automation] credentials not yet available', {
      sessionId,
      orderId,
      txnId,
      status,
      hasToken: Boolean(token),
      hasDynamicCvv: Boolean(dynamicCvv),
    })
    return null
  }

  console.log('[merchant-payment/automation] credentials fetched', {
    sessionId,
    orderId,
    txnId,
    status,
    tokenLast4: token.slice(-4),
    expiryMonth: asNonEmptyString(firstLineItem.expiry_month),
    expiryYear: asNonEmptyString(firstLineItem.expiry_year),
  })

  return {
    sessionId,
    orderId,
    txnId,
    status,
    token,
    dynamicCvv,
    expiryMonth: asNonEmptyString(firstLineItem.expiry_month),
    expiryYear: asNonEmptyString(firstLineItem.expiry_year),
  }
}

export function resolveTimeout(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return 20_000
  }

  return Math.max(5_000, Math.min(Math.floor(input), 60_000))
}

export function sanitize(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

export function maskToken(token: string): string {
  const tail = token.slice(-4)
  return `****${tail}`
}

export function normalizeMonth(month?: string): string | undefined {
  if (!month) {
    return undefined
  }

  const digits = month.replace(/\D/g, '')
  if (!digits) {
    return undefined
  }

  const parsed = Number.parseInt(digits, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    return undefined
  }

  return parsed.toString().padStart(2, '0')
}

export function normalizeYear(year?: string): string | undefined {
  if (!year) {
    return undefined
  }

  const digits = year.replace(/\D/g, '')
  if (digits.length >= 2) {
    return digits.slice(-2)
  }

  return undefined
}

export function toExpiryMMYY(month?: string, year?: string): string | undefined {
  const mm = normalizeMonth(month)
  const yy = normalizeYear(year)

  if (!mm || !yy) {
    return undefined
  }

  return `${mm}/${yy}`
}

export type MerchantPaymentWatcherResult = {
  outcome: 'success' | 'failed' | 'submitted' | 'cancelled' | 'timeout' | 'skipped_dev_mode' | 'skipped'
  sessionId?: string
  afterPaymentPage?: { title?: string; url?: string }
  error?: string
}

const DEFAULT_SELECTORS = {
  cardholderNameInput: 'input[name="cardholderName"]',
  tokenInput: 'input[name="cardNumber"]',
  cvvInput: 'input[name="cvv"]',
  expiryInput: 'input[name="expiry"]',
  payButton: 'button[type="submit"]',
  successSelector: 'text=activated successfully.',
  failureSelector: 'text=Payment Failed',
} as const

function resolveInternalBaseUrl(): string {
  const raw =
    process.env.NEXT_INTERNAL_BASE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    'http://localhost:3000'

  return raw.trim().replace(/\/$/, '')
}

export async function watchAndTriggerMerchantPayment(params: {
  sessionId: string
  merchantCheckoutUrl: string
  pollIntervalMs?: number
  maxWaitMs?: number
}): Promise<MerchantPaymentWatcherResult> {
  const { sessionId, merchantCheckoutUrl } = params
  const baseUrl = resolveInternalBaseUrl()
  const pollIntervalMs = params.pollIntervalMs ?? 5_000
  const maxWaitMs = params.maxWaitMs ?? 10 * 60 * 1_000

  // Lazy imports to avoid circular deps — these modules are server-only.
  const { isSessionCancelled } = await import('./jobStore')
  const { getPravaPaymentResult } = await import('./pravaSession')
  const { eventLogger } = await import('./eventLogger')

  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs))

    if (isSessionCancelled(sessionId)) {
      eventLogger.info('Merchant payment watcher stopped — session cancelled', {
        stage: 'merchant_payment_watcher_cancelled',
        sessionId,
      })
      return { outcome: 'cancelled', sessionId }
    }

    try {
      const paymentResult = asRecord(await getPravaPaymentResult(sessionId))
      const credentials = parseAutomationCredentials(paymentResult)

      if (!credentials) {
        continue
      }

      eventLogger.info('Credentials fetched - triggering merchant payment automation', {
        stage: 'merchant_payment_credentials_ready',
        sessionId,
      })

      const response = await fetch(`${baseUrl}/api/merchant-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantCheckoutUrl,
          sessionId,
          customer_name: 'Finops Pilot Agent',
          selectors: DEFAULT_SELECTORS,
          navigationTimeoutMs: 20_000,
          credentials: {
            token: credentials.token,
            dynamicCvv: credentials.dynamicCvv,
            expiryMonth: credentials.expiryMonth,
            expiryYear: credentials.expiryYear,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { outcome: 'failed', sessionId, error: errorText }
      }

      const data = (await response.json()) as {
        ok?: boolean
        outcome?: string
        afterPaymentPage?: { title?: string; url?: string }
      }
      const outcome = data.outcome === 'success' ? 'success' : data.outcome === 'failed' ? 'failed' : 'submitted'
      return { outcome, sessionId, afterPaymentPage: data.afterPaymentPage }
    } catch (err) {
      console.error('[merchant-payment/watcher] poll error', err)
    }
  }

  eventLogger.error('Merchant payment watcher timed out waiting for credentials', {
    stage: 'merchant_payment_watcher_timeout',
    sessionId,
  })
  return { outcome: 'timeout', sessionId }
}

// This function is intended for internal use only, for testing and demo purposes.
export async function triggerMerchantPaymentWithDirectDemoCredentials(params: {
  merchantCheckoutUrl: string
  customerName?: string
  token: string
  dynamicCvv: string
  expiryMonth?: string
  expiryYear?: string
}): Promise<MerchantPaymentWatcherResult> {
  const baseUrl = resolveInternalBaseUrl()

  console.log('[merchant-payment/demo] triggering direct demo payment automation (DEV_MODE)', {
    merchantCheckoutUrl: params.merchantCheckoutUrl,
    customerName: params.customerName ?? 'Finops Pilot Agent',
    tokenLast4: params.token.slice(-4),
  })

  const response = await fetch(`${baseUrl}/api/merchant-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantCheckoutUrl: params.merchantCheckoutUrl,
      customer_name: params.customerName ?? 'Finops Pilot Agent',
      selectors: DEFAULT_SELECTORS,
      navigationTimeoutMs: 20_000,
      credentials: {
        token: params.token,
        dynamicCvv: params.dynamicCvv,
        expiryMonth: params.expiryMonth,
        expiryYear: params.expiryYear,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[merchant-payment/demo] direct demo payment automation failed', {
      merchantCheckoutUrl: params.merchantCheckoutUrl,
      status: response.status,
      error: errorText,
    })
    return { outcome: 'failed', error: errorText }
  }

  const data = (await response.json()) as {
    outcome?: string
    afterPaymentPage?: { title?: string; url?: string }
  }

  const outcome =
    data.outcome === 'success'
      ? 'success'
      : data.outcome === 'failed'
      ? 'failed'
      : 'submitted'

  console.log('[merchant-payment/demo] demo merchant payment automation completed (DEV_MODE)', {
    outcome,
    afterPaymentPage: data.afterPaymentPage,
  })

  return { outcome, afterPaymentPage: data.afterPaymentPage }
}