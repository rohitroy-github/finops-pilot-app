import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";

import { query } from "@/app/lib/db";

export const runtime = "nodejs";

const logInSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type UserRow = RowDataPacket & {
  username: string;
};

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = logInSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 }
    );
  }

  const { username, password } = parsed.data;

  try {
    const rows = await query<UserRow[]>(
      `
        SELECT username
        FROM users
        WHERE username = ? AND password = ?
        LIMIT 1
      `,
      [username, hashPassword(password)]
    );

    if (rows.length === 0) {
      return Response.json({ error: "Invalid username or password." }, { status: 401 });
    }

    return Response.json({ ok: true, username: rows[0].username }, { status: 200 });
  } catch (error) {
    console.error("[auth/log-in] Failed to validate user", error);
    return Response.json({ error: "Unable to log in right now." }, { status: 500 });
  }
}