import { eventLogger } from '@/app/utils/eventLogger'
import { getPravaPaymentResult } from '@/app/utils/pravaSession'

export const runtime = 'nodejs'

const completedSessions = new Set<string>()
const waitingApprovalSessions = new Set<string>()

type ParsedCredentials = {
  sessionId?: string
  orderId?: string
  txnId?: string
  merchantName?: string
  merchantUrl?: string
  totalAmount?: string
  status?: string
  token?: string
  dynamicCvv?: string
  tokenLast4?: string
  expiryMonth?: string
  expiryYear?: string
  txnRefId?: string
  txnErrorCode?: string
  txnErrorMessage?: string
  hasCredentials: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

function parseCredentials(result: Record<string, unknown>): ParsedCredentials {
  const sessionId = typeof result.session_id === 'string' ? result.session_id : undefined
  const orderId = typeof result.order_id === 'string' ? result.order_id : undefined
  const transactions = Array.isArray(result.transactions) ? result.transactions : []
  const firstTxn = asRecord(transactions[0])
  const txnId = typeof firstTxn.txn_id === 'string' ? firstTxn.txn_id : undefined
  const txnError = asRecord(firstTxn.error)

  const lineItems = Array.isArray(firstTxn.line_items) ? firstTxn.line_items : []
  const firstLineItem = asRecord(lineItems[0])

  const merchantName =
    typeof firstLineItem.merchant_name === 'string' ? firstLineItem.merchant_name : undefined
  const merchantUrl =
    typeof firstLineItem.merchant_url === 'string' ? firstLineItem.merchant_url : undefined
  const totalAmount =
    typeof firstLineItem.total_amount === 'string' ? firstLineItem.total_amount : undefined
  const status = typeof firstLineItem.status === 'string' ? firstLineItem.status : undefined
  const token = typeof firstLineItem.token === 'string' ? firstLineItem.token : undefined
  const dynamicCvv =
    typeof firstLineItem.dynamic_cvv === 'string' ? firstLineItem.dynamic_cvv : undefined
  const expiryMonth =
    typeof firstLineItem.expiry_month === 'string' ? firstLineItem.expiry_month : undefined
  const expiryYear =
    typeof firstLineItem.expiry_year === 'string' ? firstLineItem.expiry_year : undefined
  const txnRefId = typeof firstLineItem.txn_ref_id === 'string' ? firstLineItem.txn_ref_id : undefined
  const txnErrorCode = typeof txnError.code === 'string' ? txnError.code : undefined
  const txnErrorMessage = typeof txnError.message === 'string' ? txnError.message : undefined

  return {
    sessionId,
    orderId,
    txnId,
    merchantName,
    merchantUrl,
    totalAmount,
    status,
      token,
      dynamicCvv,
    tokenLast4: token ? token.slice(-4) : undefined,
    expiryMonth,
    expiryYear,
    txnRefId,
    txnErrorCode,
    txnErrorMessage,
    hasCredentials: Boolean((token && dynamicCvv) || status === 'credentials_generated'),
  }
}

/**
 * Route: GET /api/prava/payment-result
 *
 * Accepts query params:
 * - sessionId (required)
 *
 * Fetches the latest Prava payment state for the session, parses credential/status
 * fields, emits lifecycle events for waiting/ready states, and returns normalized
 * payment-result data (status, txnError, hasCredentials, credentials).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return Response.json({ error: 'Missing sessionId query parameter' }, { status: 400 })
  }

  try {
    const result = asRecord(await getPravaPaymentResult(sessionId))
    const parsed = parseCredentials(result)

    if (!parsed.hasCredentials && parsed.status && !waitingApprovalSessions.has(sessionId)) {
      waitingApprovalSessions.add(sessionId)
      eventLogger.info('Waiting for approval', {
        stage: 'merchant_payment_waiting_approval',
        sessionId,
        status: parsed.status,
      })
    }

    if (parsed.hasCredentials && !completedSessions.has(sessionId)) {
      completedSessions.add(sessionId)
      waitingApprovalSessions.delete(sessionId)

      eventLogger.success('Card collected successfully.', {
        stage: 'prava_card_collected',
        sessionId,
        status: parsed.status,
      })
      eventLogger.success('Tokenized credentials recieved from Prava.', {
        stage: 'prava_credentials_generated',
        sessionId,
        orderId: parsed.orderId,
        txnId: parsed.txnId,
        tokenLast4: parsed.tokenLast4,
        expiryMonth: parsed.expiryMonth,
        expiryYear: parsed.expiryYear,
        txnRefId: parsed.txnRefId,
      })

      console.log('[prava/payment-result] credentials generated', {
        sessionId: parsed.sessionId ?? sessionId,
        orderId: parsed.orderId,
        txnId: parsed.txnId,
        merchantName: parsed.merchantName,
        merchantUrl: parsed.merchantUrl,
        totalAmount: parsed.totalAmount,
        status: parsed.status,
        tokenLast4: parsed.tokenLast4,
        expiryMonth: parsed.expiryMonth,
        expiryYear: parsed.expiryYear,
        txnRefId: parsed.txnRefId,
        token: parsed.token,
        dynamicCvv: parsed.dynamicCvv,
      })
    }

    return Response.json(
      {
        sessionId: parsed.sessionId ?? sessionId,
        orderId: parsed.orderId,
        txnId: parsed.txnId,
        merchantName: parsed.merchantName,
        merchantUrl: parsed.merchantUrl,
        totalAmount: parsed.totalAmount,
        status: parsed.status,
        txnError:
          parsed.txnErrorCode || parsed.txnErrorMessage
            ? {
                code: parsed.txnErrorCode,
                message: parsed.txnErrorMessage,
              }
            : null,
        hasCredentials: parsed.hasCredentials,
        credentials: parsed.hasCredentials
          ? {
              token: parsed.token,
              dynamicCvv: parsed.dynamicCvv,
              tokenLast4: parsed.tokenLast4,
              expiryMonth: parsed.expiryMonth,
              expiryYear: parsed.expiryYear,
              txnRefId: parsed.txnRefId,
            }
          : null,
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch payment result'
    return Response.json({ error: message }, { status: 500 })
  }
}