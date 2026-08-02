import { eventLogger } from "@/app/utils/eventLogger";

export const runtime = "nodejs";

type PravaMandate = {
  id?: string;
  recurringFrequency?: string;
  merchantName?: string;
  approvedAmount?: string;
  remaining?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PravaMandatesResponse = {
  mandates?: PravaMandate[];
};

type MandateViewModel = {
  id: string;
  username: string;
  prava_user_id: string;
  merchant_name: string;
  total_amount: number;
  frequency: string;
  charges_total: number;
  charges_made: number;
  currency: string;
  remaining: string;
  created_at: string;
  updated_at: string;
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username) {
    eventLogger.error("Mandate list failed: missing username", {
      stage: "mandate_list_error",
    });
    return Response.json(
      {
        ok: false,
        error: "Missing username query parameter",
      },
      { status: 400 },
    );
  }

  const rawSecretKey = process.env.PRAVA_SECRET_KEY;
  if (!rawSecretKey) {
    eventLogger.error("Mandate list failed: missing PRAVA_SECRET_KEY", {
      stage: "mandate_list_error",
      username,
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
    eventLogger.error("Mandate list failed: invalid PRAVA_SECRET_KEY format", {
      stage: "mandate_list_error",
      username,
    });
    return Response.json(
      {
        ok: false,
        error: "PRAVA_SECRET_KEY must start with sk_test_ or sk_live_",
      },
      { status: 500 },
    );
  }

  try {
    const baseUrl = resolvePravaBaseUrl(secretKey);
    const providerResponse = await fetch(
      `${baseUrl}/v1/mandates?customer_id=${encodeURIComponent(username)}&standing_only=true`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!providerResponse.ok) {
      const providerErrorText = await providerResponse.text();
      eventLogger.error("Prava mandate list fetch failed", {
        stage: "mandate_list_provider_error",
        username,
        status: providerResponse.status,
        error: providerErrorText,
      });
      return Response.json(
        {
          ok: false,
          error: `Prava mandates fetch failed (${providerResponse.status}): ${providerErrorText}`,
        },
        { status: providerResponse.status },
      );
    }

    const providerBody =
      (await providerResponse.json()) as PravaMandatesResponse;
    const mandates = (providerBody.mandates ?? []).map<MandateViewModel>(
      (mandate, index) => {
        const parsedAmount = Number.parseFloat(mandate.approvedAmount ?? "0");

        return {
          id: mandate.id ?? `mandate_${index}`,
          username,
          prava_user_id: username,
          merchant_name: mandate.merchantName ?? "Unknown merchant",
          total_amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
          frequency: mandate.recurringFrequency ?? "unknown",
          charges_total: 0,
          charges_made: 0,
          currency: mandate.currency ?? "USD",
          remaining: mandate.remaining ?? "0.00",
          created_at: mandate.createdAt ?? "",
          updated_at: mandate.updatedAt ?? "",
        };
      },
    );

    return Response.json(
      {
        ok: true,
        mandates,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch mandates";

    eventLogger.error("Mandate list crashed", {
      stage: "mandate_list_error",
      username,
      error: message,
    });

    return Response.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
