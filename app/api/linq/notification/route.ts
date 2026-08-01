import { z } from 'zod'

import {
  sendLinqNotification,
  type LinqNotificationPurpose,
} from '@/app/utils/linq'

export const runtime = 'nodejs'

const notificationSchema = z.object({
  from: z.string().trim().min(1).optional(),
  to: z.array(z.string().trim().min(1)).min(1).optional(),
  purpose: z.enum(['chat_notification', 'payment_link_notification']).optional(),
  message: z.string().trim().min(1).optional(),
  payment_link: z.string().trim().url().optional(),
})

export async function POST(request: Request) {
  let body: unknown = {}

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = notificationSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid notification payload.' },
      { status: 400 }
    )
  }

  try {
    const notification = await sendLinqNotification({
      from: parsed.data.from,
      to: parsed.data.to,
      purpose: parsed.data.purpose as LinqNotificationPurpose | undefined,
      message: parsed.data.message,
      paymentLink: parsed.data.payment_link,
    })
    return Response.json(notification, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send Linq notification'
    const status = message.startsWith('Missing ') ? 400 : 500
    return Response.json({ error: message }, { status })
  }
}
