import type { PlannerPage } from './browser'

export async function extractPricingText(page: PlannerPage): Promise<string> {
  console.log('[extractPricingText] in', { hasPage: Boolean(page) })

  const text = await page.evaluate(() => {
    return document.body.innerText
  })

  console.log('[extractPricingText] out', { textLength: text.length })

  return text
}
