import Link from "next/link";

const useCases = [
  {
    title: "LLM APIs",
    description:
      "Automatically upgrades OpenAI, Anthropic, Gemini, or other AI API plans when rate limits interrupt production workloads.",
    icon: "🤖",
  },
  {
    title: "Payment Recovery",
    description:
      "Detects payment failures, provisions a capped single-use virtual card, completes checkout, and restores service instantly.",
    icon: "💳",
  },
  {
    title: "CI/CD Pipelines",
    description:
      "Prevents deployments from failing because an external SaaS subscription has reached its quota or billing limit.",
    icon: "🚀",
  },
  {
    title: "Developer Productivity",
    description:
      "Engineers keep shipping code instead of switching context to upgrade plans or coordinate with finance teams.",
    icon: "👨‍💻",
  },
  {
    title: "Secure FinOps",
    description:
      "Never expose corporate credit cards. Every purchase uses a single-use virtual card with a strict spending cap.",
    icon: "🔒",
  },
  {
    title: "Self-Healing Systems",
    description:
      "Your applications recover automatically from 402 and 429 errors without human intervention.",
    icon: "⚡",
  },
];

export default function Home() {
  return (
    <main className="bg-gradient-to-b from-zinc-50 via-neutral-100 to-zinc-200 text-zinc-900">
      {/* Hero */}
      <section className="flex min-h-screen items-center justify-center px-6">
        <div className="flex flex-col items-center gap-8">
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            Finops Pilot Agent
          </h1>

          <p className="max-w-xl text-center text-sm font-medium tracking-wide text-zinc-600 md:text-base">
            An autonomous AI agent that keeps your software running by
            automatically resolving API rate limits and payment failures.
          </p>
          <Link
            href="/agent/dashboard"
            className="rounded-full border border-black bg-black px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white hover:text-black"
          >
            Let's automate
          </Link>
        </div>
      </section>

      <section className="min-h-screen flex items-center">
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="mb-14 text-center">
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-700">
              The Problem
            </span>

            <h2 className="mt-4 text-4xl font-bold md:text-5xl">
              Production shouldn't stop because of a billing page.
            </h2>

            <p className="mx-auto mt-5 max-w-3xl text-zinc-600">
              Modern applications depend on dozens of external services. When
              one hits a billing or quota limit, the entire production workflow
              can come to a halt.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-300 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 text-3xl">🚨</div>

              <h3 className="mb-3 text-xl font-semibold">
                APIs Suddenly Stop Working
              </h3>

              <p className="leading-7 text-zinc-600">
                AI models, payment gateways, cloud providers, and SaaS platforms
                can unexpectedly return <strong>HTTP 429</strong> or{" "}
                <strong>HTTP 402</strong>, breaking production systems
                instantly.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-300 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 text-3xl">⏳</div>

              <h3 className="mb-3 text-xl font-semibold">
                Manual Recovery Takes Time
              </h3>

              <p className="leading-7 text-zinc-600">
                Engineers must stop coding, investigate the issue, find a
                company card, log into vendor dashboards, and manually purchase
                a higher subscription plan.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-300 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 text-3xl">💳</div>

              <h3 className="mb-3 text-xl font-semibold">
                Corporate Cards Are Risky
              </h3>

              <p className="leading-7 text-zinc-600">
                Giving automation or distributed teams direct access to
                corporate credit cards introduces unnecessary financial exposure
                and the risk of runaway spending.
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-300 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 text-3xl">🤖</div>

              <h3 className="mb-3 text-xl font-semibold">
                AI Stops at Recommendations
              </h3>

              <p className="leading-7 text-zinc-600">
                Existing AI assistants can explain the error but cannot securely
                purchase the required plan, complete checkout, and restore the
                application automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="min-h-screen bg-black text-white flex items-center">
        <div className="mx-auto w-full max-w-7xl px-6 py-24">
          {/* Heading */}
          <div className="mb-20 text-center">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
              The Solution
            </span>

            <h2 className="mt-5 text-5xl font-bold">Finops Pilot in Action</h2>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-400">
              From detection to recovery—fully autonomous, no human intervention
              required.
            </p>
          </div>

          {/* Timeline — 4 steps, no horizontal scroll needed */}
          <div className="relative mx-auto flex w-full justify-between gap-4">
            {/* Horizontal line sits at the true vertical center of each item */}
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-zinc-700" />

            {[
              {
                step: "01",
                icon: "🚨",
                title: "Failure Detected",
                description:
                  "The application receives an HTTP 429 or HTTP 402 response from an external API.",
              },
              {
                step: "02",
                icon: "🧠",
                title: "Analyze Pricing",
                description:
                  "Open AI's LLM inspect the vendor's live pricing page and identify the best upgrade required.",
              },
              {
                step: "03",
                icon: "💳",
                title: "Generate Virtual Card",
                description:
                  "Prava instantly provisions a single-use virtual card capped exactly at the required upgrade amount.",
              },
              {
                step: "04",
                icon: "🛒",
                title: "Complete Checkout",
                description:
                  "The agent securely fills the checkout flow, confirms payment, upgrades the plan.",
              },
            ].map((item, index) => {
              const isTop = index % 2 === 0;
              return (
                <div key={item.step} className="relative h-[580px] flex-1">
                  {/* Node pinned to vertical center, always on the horizontal line */}
                  <div className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 text-2xl shadow-lg">
                    {item.icon}
                  </div>

                  {/* Card sits above the connector via z-10 */}
                  {isTop ? (
                    <div className="absolute left-0 right-0 top-0 z-10 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-2 hover:border-zinc-600 hover:shadow-2xl">
                      <p className="text-xs font-semibold tracking-[0.25em] text-zinc-500">
                        STEP {item.step}
                      </p>
                      <h3 className="mt-3 text-xl font-semibold">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                  ) : (
                    <div className="absolute left-0 right-0 bottom-0 z-10 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 transition duration-300 hover:-translate-y-2 hover:border-zinc-600 hover:shadow-2xl">
                      <p className="text-xs font-semibold tracking-[0.25em] text-zinc-500">
                        STEP {item.step}
                      </p>
                      <h3 className="mt-3 text-xl font-semibold">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="usecases" className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center">
          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            Use Cases
          </span>

          <h2 className="mt-4 text-4xl font-bold">
            Built for autonomous software.
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-zinc-600">
            Wherever software depends on paid APIs, subscriptions, or service
            quotas, Finops Pilot keeps production moving without human
            intervention.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-zinc-300 bg-white p-8 transition hover:-translate-y-2 hover:shadow-xl"
            >
              <div className="mb-5 text-4xl">{item.icon}</div>

              <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>

              <p className="leading-7 text-zinc-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[40px] bg-zinc-900 px-8 py-20 text-center text-white">
          <h2 className="text-4xl font-bold">Stop fixing billing issues.</h2>

          <p className="mt-6 max-w-2xl text-zinc-400">
            Let your applications recover from API limits and payment failures
            automatically while keeping corporate spending secure.
          </p>

          <Link
            href="/auth/log-in"
            className="mt-10 rounded-full bg-white px-8 py-4 font-semibold text-black transition hover:bg-zinc-200"
          >
            Launch Finops Pilot
          </Link>

        </div>
      </section>
    </main>
  );
}