export const runtime = 'nodejs'

function resolvePravaBaseUrl(secretKey: string): string {
  const envBaseUrl = process.env.PRAVA_API_BASE_URL?.trim()
  if (envBaseUrl) {
    return envBaseUrl
  }

  if (secretKey.startsWith('sk_test_')) {
    return 'https://sandbox.api.prava.space'
  }

  return 'https://api.prava.space'
}

export async function GET(request: Request) {
  const rawSecretKey = process.env.PRAVA_SECRET_KEY
  if (!rawSecretKey) {
    return Response.json({ error: 'Missing PRAVA_SECRET_KEY' }, { status: 500 })
  }

  const secretKey = rawSecretKey.trim()
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    return Response.json(
      { error: 'PRAVA_SECRET_KEY must start with sk_test_ or sk_live_' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const defaultCustomerId = process.env.DEMO_PRAVA_SESSION_USER_ID?.trim() || 'user_finops_pilot'
  const customerId = searchParams.get('customer_id') ?? defaultCustomerId
  const status = searchParams.get('status') ?? 'active'

  try {
    const baseUrl = resolvePravaBaseUrl(secretKey)
    const upstreamUrl = new URL('/v1/listCards', baseUrl)
    upstreamUrl.searchParams.set('customer_id', customerId)
    upstreamUrl.searchParams.set('status', status)

    const response = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      return Response.json(
        { error: `Prava listCards failed (${response.status}): ${errorText}` },
        { status: response.status }
      )
    }

    const data = (await response.json()) as Record<string, unknown>
    return Response.json(data, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch cards from Prava'
    return Response.json({ error: message }, { status: 500 })
  }
}