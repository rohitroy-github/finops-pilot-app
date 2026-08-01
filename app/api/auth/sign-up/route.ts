import { createHash } from "node:crypto";
import type { ResultSetHeader } from "mysql2";
import { z } from "zod";

import { query } from "@/app/lib/db";

export const runtime = "nodejs";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(100, "Username is too long"),
  mobileNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{10,15}$/, "Mobile number must contain 10 to 15 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

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

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }

  const { name, username, mobileNumber, password } = parsed.data;

  try {
    await query<ResultSetHeader>(
      `
        INSERT INTO users (name, username, mobile_number, password)
        VALUES (?, ?, ?, ?)
      `,
      [name, username, mobileNumber, hashPassword(password)]
    );

    return Response.json({ ok: true, username }, { status: 201 });
  } catch (error) {
    const dbError = error as { errno?: number; code?: string; message?: string };

    if (dbError.errno === 1062 || dbError.code === "ER_DUP_ENTRY") {
      return Response.json(
        { error: "Username or mobile number already exists." },
        { status: 409 }
      );
    }

    console.error("[auth/sign-up] Failed to save user", error);
    return Response.json({ error: "Unable to create user right now." }, { status: 500 });
  }
}