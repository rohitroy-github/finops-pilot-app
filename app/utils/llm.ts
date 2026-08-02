import OpenAI from 'openai'
import { z } from 'zod'

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

export type OutcomeSelectorInference = {
  successSelector?: string
  failureSelector?: string
  reasoning?: string
}

const purchasePlanSchema = z.object({
  merchantName: z.string().trim().min(1),
  exactCost: z.preprocess((value) => {
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.]/g, ''))
      return Number.isFinite(parsed) ? parsed : value
    }

    return value
  }, z.number().finite().nonnegative()),
  recommendedPlan: z.object({
    name: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
  }),
})

const outcomeSelectorInferenceSchema = z.object({
  successSelector: z.string().trim().min(1).optional(),
  failureSelector: z.string().trim().min(1).optional(),
  reasoning: z.string().trim().min(1).optional(),
})

let openAIClient: OpenAI | undefined

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }

  openAIClient ??= new OpenAI({ apiKey })
  return openAIClient
}

function resolveOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini'
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

  const client = getOpenAIClient()
  const model = resolveOpenAIModel()
  const truncatedPricingText = pricingText.slice(0, 12_000)

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You analyze SaaS and API pricing pages for an automation agent. Return JSON only with keys merchantName, exactCost, and recommendedPlan { name, rationale }. exactCost must be a number for the best-fit plan to restore or support the customer workload. Use the event context and scraped pricing text. Do not wrap the JSON in markdown.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          event: {
            dependency: event.dependency,
            billing_url: event.billing_url,
            dependency_status: event.dependency_status ?? null,
          },
          instructions: {
            objective:
              'Choose the most appropriate plan for this dependency and estimate its exact cost from the scraped pricing content.',
            outputRequirements: {
              merchantName: 'string',
              exactCost: 'number',
              recommendedPlan: {
                name: 'string',
                rationale: 'string',
              },
            },
          },
          pricingText: truncatedPricingText,
        }),
      },
    ],
  })

  const rawContent = completion.choices[0]?.message?.content?.trim()
  if (!rawContent) {
    throw new Error('OpenAI returned an empty pricing analysis response')
  }

  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawContent)
  } catch (error) {
    throw new Error(
      `OpenAI returned invalid JSON for pricing analysis: ${error instanceof Error ? error.message : 'Unknown parse error'}`
    )
  }

  const result = purchasePlanSchema.parse(parsedJson) satisfies PurchasePlan

  console.log('[analyzePricingByLLM] out', {
    model,
    merchantName: result.merchantName,
    exactCost: result.exactCost,
    plan: result.recommendedPlan.name,
  })

  return result
}

export async function inferOutcomeSelectorsByLLM(params: {
  checkoutUrl: string
  pageTitle?: string
  pageText: string
  pageHtml?: string
  knownSuccessSelector?: string
  knownFailureSelector?: string
}): Promise<OutcomeSelectorInference | null> {
  const client = getOpenAIClient()
  const model = resolveOpenAIModel()

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You infer robust Playwright selectors for payment outcome states from checkout page snapshots. Return JSON only with optional keys successSelector, failureSelector, reasoning. Prefer stable CSS selectors (id/data-testid/name/class combinations) over text selectors. If uncertain, omit the field instead of guessing.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          checkoutUrl: params.checkoutUrl,
          pageTitle: params.pageTitle ?? null,
          knownSelectors: {
            successSelector: params.knownSuccessSelector ?? null,
            failureSelector: params.knownFailureSelector ?? null,
          },
          pageText: params.pageText.slice(0, 8_000),
          pageHtml: (params.pageHtml ?? '').slice(0, 16_000),
          constraints: {
            objective:
              'Detect whether payment succeeded or failed after submit by selecting outcome-specific elements.',
            avoid: ['fragile nth-child selectors', 'long absolute selectors'],
            includeOnlyIfConfident: true,
          },
        }),
      },
    ],
  })

  const rawContent = completion.choices[0]?.message?.content?.trim()
  if (!rawContent) {
    return null
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawContent)
  } catch {
    return null
  }

  const parsed = outcomeSelectorInferenceSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return null
  }

  return parsed.data satisfies OutcomeSelectorInference
}
