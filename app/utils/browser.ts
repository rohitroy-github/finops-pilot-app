import { chromium } from 'playwright'

export type PlannerPage = {
  evaluate: <T>(fn: () => T) => Promise<T>
  context: () => { close: () => Promise<void> }
}

export async function launchBrowser(url: string): Promise<PlannerPage> {
  console.log('[launchBrowser] in', { url })

  let result: PlannerPage
  let mode: 'live_page_data' | 'mock_page_data' = 'live_page_data'

  try {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 })

    result = page
  } catch (error) {
    console.warn('[browser] Could not launch Playwright browser, returning demo page.', error)

    mode = 'mock_page_data'
    result = {
      evaluate: async <T>() =>
        [
          `Demo scrape for ${url}`,
          'Starter plan: $49/month, includes basic analytics and 10k API calls.',
          'Growth plan: $149/month, includes 100k API calls and priority support.',
          'Enterprise plan: custom pricing with SLA and dedicated support.',
        ].join('\n') as unknown as T,
      context: () => ({
        close: async () => Promise.resolve(),
      }),
    }
  }

  console.log('[launchBrowser] out', { mode })
  return result
}
