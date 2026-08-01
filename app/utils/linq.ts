export type LinqChatCreateResponse = Record<string, unknown>;
export type LinqNotificationPurpose =
  | "chat_notification"
  | "payment_link_notification";

export type LinqChatPart = {
  type: "text" | "link";
  value: string;
};

export type LinqChatMessage = {
  parts: LinqChatPart[];
};

export type LinqChatCreateParams = {
  from: string;
  message: LinqChatMessage;
  to: string[];
};

export type SendLinqNotificationParams = {
  purpose?: LinqNotificationPurpose;
  from?: string;
  to?: string[];
  message?: string;
  paymentLink?: string;
};

function resolveLinqBaseUrl(): string {
  return (
    process.env.LINQ_API_BASE_URL?.trim() ||
    "https://api.linqapp.com/api/partner/v3"
  );
}

export function resolveLinqAgentFromContactNumber(): string | undefined {
  return process.env.LINQ_AGENT_FROM_CONTACT_NUMBER?.trim() || undefined;
}

export function resolveLinqAgentToContactNumber(): string | undefined {
  return process.env.LINQ_AGENT_TO_CONTACT_NUMBER?.trim() || undefined;
}

function buildLinqNotificationPayload(
  params: SendLinqNotificationParams,
): LinqChatCreateParams {
  const from = params.from || resolveLinqAgentFromContactNumber();
  if (!from) {
    throw new Error(
      "Missing from. Provide from or configure LINQ_AGENT_FROM_CONTACT_NUMBER.",
    );
  }

  const to = params.to?.filter(Boolean) ||
    (resolveLinqAgentToContactNumber() ? [resolveLinqAgentToContactNumber() as string] : []);
  if (to.length === 0) {
    throw new Error(
      "Missing to. Provide to[] or configure LINQ_AGENT_TO_CONTACT_NUMBER.",
    );
  }

  const purpose = params.purpose ?? "chat_notification";
  if (purpose === "payment_link_notification" && !params.paymentLink) {
    throw new Error(
      "Missing paymentLink. Provide paymentLink when purpose is payment_link_notification.",
    );
  }

  return {
    from,
    to,
    message: {
      parts:
        purpose === "payment_link_notification"
          ? [{ type: "link", value: params.paymentLink as string }]
          : [
              {
                type: "text",
                value: params.message || "Hello! How can I help you today?",
              },
            ],
    },
  };
}

function resolveLinqApiKey(): string {
  const key =
    process.env.LINQ_API_V3_API_KEY?.trim() || process.env.LINQ_TOKEN?.trim();
  if (!key) {
    throw new Error("Missing LINQ_API_V3_API_KEY (or LINQ_TOKEN)");
  }

  return key;
}

export async function createLinqChatNotification(
  payload: LinqChatCreateParams,
): Promise<LinqChatCreateResponse> {
  const apiBaseUrl = resolveLinqBaseUrl();
  const apiKey = resolveLinqApiKey();

  const response = await fetch(`${apiBaseUrl}/chats`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Linq chat notification failed (${response.status}): ${errorText}`,
    );
  }

  return (await response.json()) as LinqChatCreateResponse;
}

export async function sendLinqNotification(
  params: SendLinqNotificationParams,
): Promise<LinqChatCreateResponse> {
  const purpose = params.purpose ?? "chat_notification";
  const payload = buildLinqNotificationPayload(params);
  const response = await createLinqChatNotification(payload);

  console.log("[linq] Sent user a notification", {
    purpose,
  });

  return response;
}
