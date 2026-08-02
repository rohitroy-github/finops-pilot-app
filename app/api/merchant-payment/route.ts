import { chromium } from "playwright";

import { eventLogger } from "@/app/utils/eventLogger";
import {
  inferCheckoutSelectorsByLLM,
} from "@/app/utils/llm";
import {
  getPravaPaymentResult,
  reportPravaMerchantPaymentOutcome,
} from "@/app/utils/pravaSession";
import {
  asNonEmptyString,
  asRecord,
  isMerchantPaymentBody,
  maskToken,
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

  eventLogger.info("Initialized merchant payment automation successfully.", {
    stage: "merchant_payment_start",
    merchantCheckoutUrl,
    pravapravaSessionId: body.sessionId,
    tokenLast4: credentials.token.slice(-4),
  });
  console.log("[merchant-payment/automation] automation starts here", {
    merchantCheckoutUrl,
    pravaSessionId: body.sessionId,
    cardNumber: maskToken(credentials.token),
  });
  eventLogger.info("Processing card information.", {
    stage: "merchant_payment_processing",
    merchantCheckoutUrl,
    pravaSessionId: body.sessionId,
  });
  console.log("[merchant-payment/automation] card details being used (masked)", {
    cardNumber: maskToken(credentials.token),
    cardCVV: "*".repeat(credentials.dynamicCvv.length),
    cardExpiryMonth: credentials.expiryMonth,
    cardExpiryYear: credentials.expiryYear,
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

    let effectiveSelectors: MerchantPaymentSelectors = { ...selectors };

    try {
      const [pageTitle, pageText, pageHtml] = await Promise.all([
        page.title(),
        page.evaluate(() => document.body?.innerText ?? ""),
        page.content(),
      ]);

      const inferredCheckoutSelectors = await inferCheckoutSelectorsByLLM({
        checkoutUrl: merchantCheckoutUrl,
        pageTitle,
        pageText,
        pageHtml,
        knownSelectors: {
          cardholderNameInput: selectors.cardholderNameInput,
          tokenInput: selectors.tokenInput,
          cvvInput: selectors.cvvInput,
          expiryInput: selectors.expiryInput,
          expiryMonthInput: selectors.expiryMonthInput,
          expiryYearInput: selectors.expiryYearInput,
          payButton: selectors.payButton,
        },
      });

      console.log("[merchant-payment/automation] LLM analyzed checkout selectors", {
        inferredCheckoutSelectors,
      });

      if (inferredCheckoutSelectors) {
        effectiveSelectors = {
          ...selectors,
          ...(inferredCheckoutSelectors.cardholderNameInput
            ? { cardholderNameInput: inferredCheckoutSelectors.cardholderNameInput }
            : {}),
          ...(inferredCheckoutSelectors.tokenInput
            ? { tokenInput: inferredCheckoutSelectors.tokenInput }
            : {}),
          ...(inferredCheckoutSelectors.cvvInput
            ? { cvvInput: inferredCheckoutSelectors.cvvInput }
            : {}),
          ...(inferredCheckoutSelectors.expiryInput
            ? { expiryInput: inferredCheckoutSelectors.expiryInput }
            : {}),
          ...(inferredCheckoutSelectors.expiryMonthInput
            ? { expiryMonthInput: inferredCheckoutSelectors.expiryMonthInput }
            : {}),
          ...(inferredCheckoutSelectors.expiryYearInput
            ? { expiryYearInput: inferredCheckoutSelectors.expiryYearInput }
            : {}),
          ...(inferredCheckoutSelectors.payButton
            ? { payButton: inferredCheckoutSelectors.payButton }
            : {}),
        };

        eventLogger.info("LLM analyzed checkout page form selectors verified successfully", {
          stage: "merchant_payment_llm_checkout_selector_inference",
          merchantCheckoutUrl,
          tokenInput: effectiveSelectors.tokenInput,
          cvvInput: effectiveSelectors.cvvInput,
          payButton: effectiveSelectors.payButton,
        });
      }
    } catch (error) {
      console.warn(
        "[merchant-payment/automation] LLM checkout selector inference failed",
        {
          merchantCheckoutUrl,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
    }

    if (effectiveSelectors.cardholderNameInput && customerName) {
      await page.fill(effectiveSelectors.cardholderNameInput, customerName);
    }

    await page.fill(effectiveSelectors.tokenInput, credentials.token);
    await page.fill(effectiveSelectors.cvvInput, credentials.dynamicCvv);

    const expiryMMYY = toExpiryMMYY(
      credentials.expiryMonth,
      credentials.expiryYear,
    );

    if (effectiveSelectors.expiryInput && expiryMMYY) {
      await page.fill(effectiveSelectors.expiryInput, expiryMMYY);
    }

    if (effectiveSelectors.expiryMonthInput && credentials.expiryMonth) {
      await page.fill(effectiveSelectors.expiryMonthInput, credentials.expiryMonth);
    }

    if (effectiveSelectors.expiryYearInput && credentials.expiryYear) {
      await page.fill(effectiveSelectors.expiryYearInput, credentials.expiryYear);
    }

    console.log(
      "[merchant-payment/automation] filling payment check-out form feilds",
      {
        merchantCheckoutUrl,
      },
    );

    await page.click(effectiveSelectors.payButton);

    eventLogger.info("Paying merchant now with card.", {
      stage: "merchant_payment_waiting_approval",
      merchantCheckoutUrl,
      pravaSessionId: body.sessionId,
    });
    console.log(
      "[merchant-payment/automation] submitting credentials, making payment now",
      {
        merchantCheckoutUrl,
      },
    );

    // Stage 4: Wait for success/failure signals and return normalized result payload.
    let outcome: "submitted" | "success" | "failed" = "submitted";

    if (effectiveSelectors.successSelector) {
      try {
        await page.waitForSelector(effectiveSelectors.successSelector, {
          timeout: timeoutMs,
        });
        outcome = "success";
      } catch {
        outcome = "submitted";
      }
    }

    if (effectiveSelectors.failureSelector) {
      try {
        await page.waitForSelector(effectiveSelectors.failureSelector, {
          timeout: 1_500,
        });
        outcome = "failed";
      } catch {
        // Keep previous outcome when failure selector is not found quickly.
      }
    }

    if (body.sessionId) {
      try {
        const pravaReport = await reportPravaMerchantPaymentOutcome({
          sessionId: body.sessionId,
          outcome,
        });

        if (pravaReport) {
          eventLogger.success(
            `Reported merchant payment status to Prava as: ${pravaReport.txn_status}.`,
            {
              stage: "prava_report_status_success",
              sessionId: body.sessionId,
              txnRefId: pravaReport.txn_ref_id,
              txnStatus: pravaReport.txn_status,
              visaConfirmation: pravaReport.visa_confirmation,
            },
          );
        } else {
          eventLogger.info(
            "Skipped Prava report-status check because outcome is still submitted.",
            {
              stage: "prava_report_status_skipped",
              sessionId: body.sessionId,
              outcome,
            },
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown report-status error";

        eventLogger.error("Failed to report merchant payment status to Prava.", {
          stage: "prava_report_status_error",
          sessionId: body.sessionId,
          outcome,
          error: message,
        });
        console.error(
          "[merchant-payment/automation] prava report-status failed",
          {
            sessionId: body.sessionId,
            outcome,
            error: message,
          },
        );
      }
    }

    const title = await page.title();
    const currentUrl = page.url();

    eventLogger.success(`Automation ended with outcome: ${outcome}.`, {
      stage: "merchant_payment_complete",
      merchantCheckoutUrl,
      afterPaymentCheckoutURL: currentUrl,
      outcome,
      tokenLast4: credentials.token.slice(-4),
    });
    console.log("[merchant-payment/automation] automation ends here", {
      pravaSessionId: body.sessionId,
      outcome,
      afterPaymentCheckoutURL: currentUrl,
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
