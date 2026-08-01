export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ensureDBReady } = await import("@/app/lib/db");
  await ensureDBReady();
}
