import { eventLogger } from "@/app/utils/eventLogger";

export const runtime = "nodejs";

type MandateCreatePayload = {
  user_id?: string;
  user_email?: string;
  total_amount?: string;
  currency?: string;
  purchase_context?: Array<{
    merchant_details?: {
      name?: string;
      url?: string;
      country_code_iso2?: string;
    };
    product_details?: Array<{
      description?: string;
      unit_price?: string;
    }>;
  }>;
  mandate_setup?: {
    intent?: "mandate_setup";
    recurring_frequency?: string;
    merchant_scope?: string;
    max_charges?: number;
  };
};

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as MandateCreatePayload;

    const username = payload.user_id?.trim();
    const userEmail = payload.user_email?.trim();
    const merchantName = payload.purchase_context?.[0]?.merchant_details?.name?.trim();
    const amount = Number.parseFloat(payload.total_amount ?? "0");
    const frequency = payload.mandate_setup?.recurring_frequency?.trim().toLowerCase() ?? "";
    const rawSecretKey = process.env.PRAVA_SECRET_KEY;

    eventLogger.info("Mandate create request received", {
      stage: "mandate_create_start",
      username,
      merchantName,
      frequency,
      amount: Number.isFinite(amount) ? amount : payload.total_amount,
    });

    if (!rawSecretKey) {
      eventLogger.error("Mandate create failed: missing PRAVA_SECRET_KEY", {
        stage: "mandate_create_error",
      });
      return Response.json(
        {
          ok: false,
          error: "Missing PRAVA_SECRET_KEY",
        },
        { status: 500 },
      );
    }

    const secretKey = rawSecretKey.trim();
    if (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_")) {
      eventLogger.error("Mandate create failed: invalid PRAVA_SECRET_KEY format", {
        stage: "mandate_create_error",
      });
      return Response.json(
        {
          ok: false,
          error: "PRAVA_SECRET_KEY must start with sk_test_ or sk_live_",
        },
        { status: 500 },
      );
    }

    if (!username) {
      eventLogger.error("Mandate create failed: missing user_id", {
        stage: "mandate_create_error",
      });
      return Response.json(
        {
          ok: false,
          error: "Missing user_id",
        },
        { status: 400 },
      );
    }

    if (!merchantName) {
      eventLogger.error("Mandate create failed: missing merchant name", {
        stage: "mandate_create_error",
      });
      return Response.json(
        {
          ok: false,
          error: "Missing purchase_context[0].merchant_details.name",
        },
        { status: 400 },
      );
    }

    if (!userEmail) {
      eventLogger.error("Mandate create failed: missing user email", {
        stage: "mandate_create_error",
      });
      return Response.json(
        {
          ok: false,
          error: "Missing user_email",
        },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      eventLogger.error("Mandate create failed: invalid total amount", {
        stage: "mandate_create_error",
        amount: payload.total_amount,
      });
      return Response.json(
        {
          ok: false,
          error: "Invalid total_amount",
        },
        { status: 400 },
      );
    }

    if (!frequency) {
      eventLogger.error("Mandate create failed: missing recurring frequency", {
        stage: "mandate_create_error",
      });
      return Response.json(
        {
          ok: false,
          error: "Missing mandate_setup.recurring_frequency",
        },
        { status: 400 },
      );
    }

    const baseUrl = resolvePravaBaseUrl(secretKey);
    const pravaResponse = await fetch(`${baseUrl}/v1/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!pravaResponse.ok) {
      const providerErrorText = await pravaResponse.text();
      eventLogger.error("Prava mandate session creation failed", {
        stage: "mandate_create_provider_error",
        username,
        status: pravaResponse.status,
        error: providerErrorText,
      });
      return Response.json(
        {
          ok: false,
          error: `Prava session create failed (${pravaResponse.status}): ${providerErrorText}`,
        },
        { status: pravaResponse.status },
      );
    }

    const pravaBody = (await pravaResponse.json()) as {
      session_id?: string;
      session_token?: string;
      iframe_url?: string;
      order_id?: string;
      expires_at?: string;
      authorizeOnly?: boolean;
    };

    console.log("[prava/mandate/create] payload received", payload);
    console.log("[prava/mandate/create] session created", {
      username,
      merchantName,
      amount,
      frequency,
      sessionId: pravaBody.session_id,
      orderId: pravaBody.order_id,
    });

    eventLogger.success("Prava mandate session created", {
      stage: "mandate_create_success",
      username,
      merchantName,
      sessionId: pravaBody.session_id,
      orderId: pravaBody.order_id,
      iframeUrl: pravaBody.iframe_url,
    });

    return Response.json(
      {
        ok: true,
        message: "Prava session created",
        session: pravaBody,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid request payload";

    eventLogger.error("Mandate create crashed", {
      stage: "mandate_create_error",
      error: message,
    });

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 },
    );
  }
}
