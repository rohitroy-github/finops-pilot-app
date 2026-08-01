export type PurchasePlan = {
  merchantName: string
  exactCost: number
  recommendedPlan: {
    name: string
    rationale: string
  }
}

type NormalizedEvent = {
  dependency: string
  billing_url: string
  dependency_status?: string
}

export async function analyzePricingByLLM(
  pricingText: string,
  event: NormalizedEvent
): Promise<PurchasePlan> {
  console.log('[analyzePricingByLLM] in', {
    dependency: event.dependency,
    billing_url: event.billing_url,
    dependency_status: event.dependency_status,
    pricingTextLength: pricingText.length,
  })

  // Demo response for now; replace this block with real LLM invocation.
  const result: PurchasePlan = {
    merchantName: event.dependency,
    exactCost: 10,
    recommendedPlan: {
      name: 'Developer Plan',
      rationale: `Demo result based on scraped text (${pricingText.length} chars). Suitable for moderate-to-high API usage.`,
    },
  }

  console.log('[analyzePricingByLLM] out', {
    merchantName: result.merchantName,
    exactCost: result.exactCost,
    plan: result.recommendedPlan.name,
  })

  return result
}
