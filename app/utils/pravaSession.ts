import type { RowDataPacket } from "mysql2";

import { query } from "@/app/lib/db";
import { sendLinqNotification } from "@/app/utils/linq";
import type { PlannerJob } from "./jobStore";
import type { PurchasePlan } from "./llm";

type PravaSessionRequestBody = {
  user_id: string;
  user_email: string;
  user_phone?: string;
  total_amount: string;
  currency: string;
  integration_type: "embedding" | "full_checkout";
  purchase_context: Array<{
    merchant_details: {
      name: string;
      url: string;
      country_code_iso2: string;
    };
    product_details: Array<{
      description: string;
      unit_price: string;
      quantity: number;
    }>;
  }>;
};

type PravaSessionResponse = {
  session_id?: string;
  iframe_url?: string;
  session_token?: string;
};

type UserPravaIdRow = RowDataPacket & {
  prava_user_id: string;
};

type UserNotificationHandleRow = RowDataPacket & {
  mobile_number: string;
};

export type PravaPaymentResultResponse = Record<string, unknown>;

function resolvePravaBaseUrl(secretKey: string): string {
  const envBaseUrl = process.env.PRAVA_API_BASE_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl;
  }

  if (secretKey.startsWith("sk_test_")) {
    return "https://sandbox.api.prava.space";
  }

  return "https://api.prava.space";
}

function parseAmount(raw: number | string): string {
  const numeric =
    typeof raw === "number"
      ? raw
      : Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "10.00";
  }
  return numeric.toFixed(2);
}

function asPurchasePlan(value: unknown): PurchasePlan {
  return value as PurchasePlan;
}

function asJobEvent(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function resolveUsernameFromEvent(
  event: Record<string, unknown>,
): string | undefined {
  return readString(event.client_username) ?? readString(event.username);
}

async function resolvePravaUserIdFromUsersTable(
  event: Record<string, unknown>,
): Promise<string> {
  const username = resolveUsernameFromEvent(event);

  if (!username) {
    throw new Error(
      "Missing username on planner job event. Cannot resolve prava_user_id from users table.",
    );
  }

  const rows = await query<UserPravaIdRow[]>(
    `
      SELECT prava_user_id
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username],
  );

  const pravaUserId = rows[0]?.prava_user_id;
  if (!pravaUserId) {
    throw new Error(
      `No prava_user_id found in users table for username: ${username}`,
    );
  }

  return pravaUserId;
}

async function buildBody(job: PlannerJob): Promise<PravaSessionRequestBody> {
  // Map planner output to Prava's Create Session schema with safe demo defaults.
  const purchasePlan = asPurchasePlan(job.purchasePlan);
  const event = asJobEvent(job.event);

  const processed_email =
    process.env.DEMO_PRAVA_SESSION_EMAIL ?? "rhtry.tech@gmail.com";
  const processed_phone_number =
    process.env.DEMO_PRAVA_SESSION_NUMBER ?? "7003275110";
  const processed_user_id = await resolvePravaUserIdFromUsersTable(event);
  const processed_merchant_name =
    purchasePlan?.merchantName || "TranslateAI_DEMO_SAAS";
  const processed_merchant_url =
    (typeof event.billing_url === "string" && event.billing_url) ||
    (typeof event.merchant_billing_url === "string" &&
      event.merchant_billing_url) ||
    "http://localhost:3001/checkout?plan=Developer";
  const processed_total_amount = parseAmount(purchasePlan?.exactCost ?? 10);
  const processed_product_desc =
    purchasePlan?.recommendedPlan?.name || "API Service Subscription Plan";

  return {
    user_id: processed_user_id,
    user_email: processed_email,
    user_phone: processed_phone_number,
    total_amount: processed_total_amount,
    currency: "INR",
    integration_type: "embedding",
    purchase_context: [
      {
        merchant_details: {
          name: processed_merchant_name,
          url: processed_merchant_url,
          country_code_iso2: "IN",
        },
        product_details: [
          {
            description: processed_product_desc,
            unit_price: processed_total_amount,
            quantity: 1,
          },
        ],
      },
    ],
  };
}

export async function createPravaSessionFromPlannerJob(
  job: PlannerJob,
): Promise<PravaSessionResponse> {
  // Server-only key used for creating sessions against Prava's backend API.
  const rawSecretKey = process.env.PRAVA_SECRET_KEY;
  if (!rawSecretKey) {
    throw new Error("Missing PRAVA_SECRET_KEY");
  }

  const secretKey = rawSecretKey.trim();
  // Guardrail to fail fast when test/live secret format is invalid.
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    throw new Error("PRAVA_SECRET_KEY must start with sk_test_ or sk_live_");
  }

  const baseUrl = resolvePravaBaseUrl(secretKey);
  const event = asJobEvent(job.event);
  const body = await buildBody(job);

  // Create a Prava session that the frontend uses for collectPAN/iframe flows.
  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Bubble up provider response body to speed up integration debugging.
    const errorText = await response.text();
    try {
      await sendLinqNotification({
        purpose: "chat_notification",
        message: `Hi, this is your Finops Pilot. I could not create your payment session right now. Error: ${errorText}`,
      });
    } catch (notificationError) {
      console.error(
        "[prava/session] Failed to send notification",
        notificationError,
      );
    }
    throw new Error(
      `Prava session create failed (${response.status}): ${errorText}`,
    );
  }

  const sessionResponse = (await response.json()) as PravaSessionResponse;

  try {
    if (sessionResponse.iframe_url) {
      await sendLinqNotification({
        purpose: "chat_notification",
        message:
          "I have created a Prava payemnt session successfully, please approve the payment using the shared link below or visit your dashbaord.",
      });
      await sendLinqNotification({
        purpose: "payment_link_notification",
        paymentLink: sessionResponse.iframe_url,
      });
    } else {
      await sendLinqNotification({
        purpose: "chat_notification",
        message:
          "Hi, this is your Finops Pilot. Your payment session was created successfully.",
      });
    }
  } catch (notificationError) {
    console.error(
      "[prava/session] Failed to send notification",
      notificationError,
    );
  }

  return sessionResponse;
}

export async function getPravaPaymentResult(
  sessionId: string,
): Promise<PravaPaymentResultResponse> {
  const rawSecretKey = process.env.PRAVA_SECRET_KEY;
  if (!rawSecretKey) {
    throw new Error("Missing PRAVA_SECRET_KEY");
  }

  const secretKey = rawSecretKey.trim();
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    throw new Error("PRAVA_SECRET_KEY must start with sk_test_ or sk_live_");
  }

  const baseUrl = resolvePravaBaseUrl(secretKey);

  const response = await fetch(
    `${baseUrl}/v1/sessions/${sessionId}/payment-result`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Prava payment-result failed (${response.status}): ${errorText}`,
    );
  }

  return (await response.json()) as PravaPaymentResultResponse;
}

export async function revokePravaSession(
  sessionId: string,
): Promise<Record<string, unknown>> {
  const rawSecretKey = process.env.PRAVA_SECRET_KEY;
  if (!rawSecretKey) {
    throw new Error("Missing PRAVA_SECRET_KEY");
  }

  const secretKey = rawSecretKey.trim();
  if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
    throw new Error("PRAVA_SECRET_KEY must start with sk_test_ or sk_live_");
  }

  const baseUrl = resolvePravaBaseUrl(secretKey);

  const response = await fetch(`${baseUrl}/v1/sessions/${sessionId}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prava revoke failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}
