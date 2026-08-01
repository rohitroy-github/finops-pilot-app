import { runPlanner, type DependencyEventPayload } from "@/app/utils/planner";
import { sendLinqNotification } from "@/app/utils/linq";

export const runtime = "nodejs";

function isDependencyEventPayload(
  value: unknown,
): value is DependencyEventPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.dependency_merchant === "string" &&
    typeof payload.dependency_working_status === "string" &&
    typeof payload.merchant_billing_url === "string" &&
    typeof payload.client_username === "string" &&
    typeof payload.client_token === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isDependencyEventPayload(body)) {
    return Response.json(
      {
        error:
          "Invalid payload. Required fields: dependency_merchant, dependency_working_status, merchant_billing_url, client_username, client_token (all strings).",
      },
      { status: 400 },
    );
  }

  console.log("[api/event] Event received:", body);

  try {
    await sendLinqNotification({
      purpose: "chat_notification",
      message: `Hi ${body.client_username}, this is your Finops Pilot - I just receievd an alert that your ${body.dependency_merchant} API has reached a status : ${body.dependency_working_status}. I'm gonna upgrade this subscription automatically now.`,
    });
  } catch (error) {
    console.error("[api/event] Failed to send client notification", error);
  }

  // Dev mode: planner execution is temporarily disabled.
  const plannerResult = await runPlanner(body);
  console.log("[api/event] Planner result:", plannerResult);

  return Response.json(
    {
      message: "Event received and planner executed (demo).",
      planner: plannerResult,
    },
    { status: 200 },
  );
}
