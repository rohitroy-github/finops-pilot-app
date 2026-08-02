import type { RowDataPacket } from "mysql2";
import { z } from "zod";

import { query } from "@/app/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  username: z.string().trim().min(1, "username is required"),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

type EventRow = RowDataPacket & {
  id: number;
  username: string;
  inc_merchant_name: string;
  inc_merchant_status: string;
  payment_amount: number | string;
  agent_final_payment_status: string;
  created_at: string | Date;
};

type ParsedInput = {
  username: string;
  limit: number;
};

function parseInput(input: { username?: unknown; limit?: unknown }) {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: Response.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true as const,
    data: {
      username: parsed.data.username,
      limit: parsed.data.limit ?? 20,
    } satisfies ParsedInput,
  };
}

async function fetchEvents({ username, limit }: ParsedInput) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

  const rows = await query<EventRow[]>(
    `
      SELECT
        id,
        username,
        inc_merchant_name,
        inc_merchant_status,
        payment_amount,
        agent_final_payment_status,
        created_at
      FROM events
      WHERE username = ?
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `,
    [username]
  );

  return rows.map((row) => ({
    id: String(row.id),
    username: row.username,
    dependency: row.inc_merchant_name,
    incidentStatus: row.inc_merchant_status,
    paymentAmount: Number(row.payment_amount ?? 0),
    paymentStatus: row.agent_final_payment_status,
    receivedAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = parseInput({
    username: searchParams.get("username") ?? "",
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const events = await fetchEvents(parsed.data);

    return Response.json({ events }, { status: 200 });
  } catch (error) {
    console.error("[api/events] Failed to fetch events", error);
    return Response.json(
      { error: "Unable to fetch events right now." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const parsed = parseInput({
    username: payload.username,
    limit: payload.limit,
  });

  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    const events = await fetchEvents(parsed.data);

    return Response.json({ events }, { status: 200 });
  } catch (error) {
    console.error("[api/events] Failed to fetch events", error);
    return Response.json(
      { error: "Unable to fetch events right now." },
      { status: 500 }
    );
  }
}
