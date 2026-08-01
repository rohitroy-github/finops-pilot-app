import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-linear-to-b from-zinc-50 via-neutral-100 to-zinc-200 text-zinc-900 flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8">
      <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          Finops Pilot Agent
        </h1>
        <p className="max-w-xl text-center text-sm font-medium tracking-wide text-zinc-600 md:text-base">
          Your AI copilot for FinOps decisions.
        </p>
        <Link
          href="/agent/dashboard"
          className="rounded-full border border-black bg-black px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-black"
        >
          Let's automate
        </Link>
      </div>
    </main>
  );
}
