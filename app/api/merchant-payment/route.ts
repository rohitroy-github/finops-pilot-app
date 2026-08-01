import { chromium } from "playwright";

import { eventLogger } from "@/app/utils/eventLogger";
import { getPravaPaymentResult } from "@/app/utils/pravaSession";
import {
  asNonEmptyString,
  asRecord,
  isMerchantPaymentBody,
  parseAutomationCredentials,
  resolveTimeout,
  sanitize,
  toExpiryMMYY,
  type AutomationCredentials,
  type MerchantPaymentBody,
  type MerchantPaymentSelectors,
} from "@/app/utils/merchantPayment";

export const runtime = "nodejs";

/**
 * Route: POST /api/merchant-payment
 *
 * Accepts merchant checkout automation payload with:
 * - merchantCheckoutUrl (required)
 * - selectors.tokenInput, selectors.cvvInput, selectors.payButton (required)
 * - selectors.cardholderNameInput, selectors.expiryInput, selectors.expiryMonthInput,
 *   selectors.expiryYearInput, selectors.successSelector, selectors.failureSelector (optional)
 * - credentials.token + credentials.dynamicCvv (optional direct credentials), or sessionId
 * - customer_name and navigationTimeoutMs (optional)
 *
 * Validates input, resolves credentials, submits payment via Playwright, then returns
 * normalized outcome data (submitted/success/failed) and post-payment page info.
 */
export async function POST(request: Request) {
  // Stage 1: Parse and validate incoming merchant-payment request payload from the agent.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isMerchantPaymentBody(body)) {
    return Response.json(
      {
        error:
          "Invalid payload. Required fields: merchantCheckoutUrl (string), selectors.tokenInput (string), selectors.cvvInput (string), selectors.payButton (string).",
      },
      { status: 400 },
    );
  }

  const merchantCheckoutUrl = sanitize(body.merchantCheckoutUrl);
  const timeoutMs = resolveTimeout(body.navigationTimeoutMs);

  console.log(
    "[merchant-payment/automation] merchant payment request received, starting automation ...",
    {
      merchantCheckoutUrl,
      pravapravaSessionId: body.sessionId,
      customer_name: body.customer_name,
    },
  );

  // Stage 2: Resolve tokenized credentials from direct payload or Prava session result.
  let credentials: AutomationCredentials | null = null;
  const directCredentials = body.credentials;

  if (directCredentials?.token && directCredentials?.dynamicCvv) {
    credentials = {
      token: directCredentials.token,
      dynamicCvv: directCredentials.dynamicCvv,
      expiryMonth: directCredentials.expiryMonth,
      expiryYear: directCredentials.expiryYear,
    };
  } else if (body.sessionId) {
    const paymentResult = asRecord(await getPravaPaymentResult(body.sessionId));
    credentials = parseAutomationCredentials(paymentResult);
  }

  if (!credentials) {
    console.warn("[merchant-payment/automation] no usable credentials found", {
      merchantCheckoutUrl,
      pravapravaSessionId: body.sessionId,
    });
    return Response.json(
      {
        error:
          "No usable payment credentials found. Pass credentials.token + credentials.dynamicCvv directly, or provide pravapravaSessionId with generated tokenized credentials.",
      },
      { status: 409 },
    );
  }

  const selectors = body.selectors;
  const customerName = asNonEmptyString(body.customer_name);

  eventLogger.info("Initialized automation.", {
    stage: "merchant_payment_start",
    merchantCheckoutUrl,
    pravapravaSessionId: body.sessionId,
    tokenLast4: credentials.token.slice(-4),
  });
  console.log("[merchant-payment/automation] automation starts here", {
    merchantCheckoutUrl,
    pravaSessionId: body.sessionId,
    tokenLast4: credentials.token.slice(-4),
  });
  eventLogger.info("Processing payment information.", {
    stage: "merchant_payment_processing",
    merchantCheckoutUrl,
    pravaSessionId: body.sessionId,
  });

  // Stage 3: Launch browser automation and populate checkout form fields.
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(merchantCheckoutUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (selectors.cardholderNameInput && customerName) {
      await page.fill(selectors.cardholderNameInput, customerName);
    }

    await page.fill(selectors.tokenInput, credentials.token);
    await page.fill(selectors.cvvInput, credentials.dynamicCvv);

    const expiryMMYY = toExpiryMMYY(
      credentials.expiryMonth,
      credentials.expiryYear,
    );

    if (selectors.expiryInput && expiryMMYY) {
      await page.fill(selectors.expiryInput, expiryMMYY);
    }

    if (selectors.expiryMonthInput && credentials.expiryMonth) {
      await page.fill(selectors.expiryMonthInput, credentials.expiryMonth);
    }

    if (selectors.expiryYearInput && credentials.expiryYear) {
      await page.fill(selectors.expiryYearInput, credentials.expiryYear);
    }

    console.log(
      "[merchant-payment/automation] filling payment check-out form feilds",
      {
        merchantCheckoutUrl,
        pravaSessionId: body.sessionId,
      },
    );

    await page.click(selectors.payButton);

    eventLogger.info("Paying merchant now.", {
      stage: "merchant_payment_waiting_approval",
      merchantCheckoutUrl,
      pravaSessionId: body.sessionId,
    });
    console.log(
      "[merchant-payment/automation] submitting credentials, making payment now",
      {
        merchantCheckoutUrl,
        pravaSessionId: body.sessionId,
      },
    );

    // Stage 4: Wait for success/failure signals and return normalized result payload.
    let outcome: "submitted" | "success" | "failed" = "submitted";

    if (selectors.successSelector) {
      try {
        await page.waitForSelector(selectors.successSelector, {
          timeout: timeoutMs,
        });
        outcome = "success";
      } catch {
        outcome = "submitted";
      }
    }

    if (selectors.failureSelector) {
      try {
        await page.waitForSelector(selectors.failureSelector, {
          timeout: 1_500,
        });
        outcome = "failed";
      } catch {
        // Keep previous outcome when failure selector is not found quickly.
      }
    }

    const title = await page.title();
    const currentUrl = page.url();

    eventLogger.success("Automation ended successfull.", {
      stage: "merchant_payment_complete",
      merchantCheckoutUrl,
      afterPaymentCheckoutURL: currentUrl,
      outcome,
      tokenLast4: credentials.token.slice(-4),
    });
    console.log("[merchant-payment/automation] automation ends here", {
      merchantCheckoutUrl,
      pravaSessionId: body.sessionId,
      outcome,
      afterPaymentCheckoutURL: currentUrl,
      tokenLast4: credentials.token.slice(-4),
    });

    return Response.json(
      {
        ok: true,
        outcome,
        merchantCheckoutUrl,
        afterPaymentPage: {
          title,
          url: currentUrl,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    // Stage 5: Surface automation failure details for observability and caller handling.
    const message =
      error instanceof Error
        ? error.message
        : "Merchant payment automation failed";

    console.error("[merchant-payment/automation] payment automation error", {
      merchantCheckoutUrl,
      pravaSessionId: body.sessionId,
      error: message,
    });

    eventLogger.error("Automation failed.", {
      stage: "merchant_payment_error",
      merchantCheckoutUrl,
      pravaSessionId: body.sessionId,
      error: message,
    });

    return Response.json({ ok: false, error: message }, { status: 500 });
  } finally {
    // Always close browser resources to avoid leaking Playwright contexts/pages.
    await context.close();
    await browser.close();
  }
}
