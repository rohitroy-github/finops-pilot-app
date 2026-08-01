"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthFormCardProps = {
  mode: "log-in" | "sign-up";
  title: string;
  subtitle: string;
  submitLabel: string;
  alternatePrompt: string;
  alternateHref: string;
  alternateLabel: string;
};

export default function AuthFormCard({
  mode,
  title,
  subtitle,
  submitLabel,
  alternatePrompt,
  alternateHref,
  alternateLabel,
}: AuthFormCardProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      if (mode === "sign-up") {
        try {
          const response = await fetch("/api/auth/sign-up", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: name.trim(),
              username: normalizedUsername,
              mobileNumber: mobileNumber.trim(),
              password,
            }),
          });

          const payload = (await response.json()) as { error?: string };
          if (!response.ok) {
            setSubmitError(payload.error ?? "Unable to sign up. Please try again.");
            return;
          }
        } catch {
          setSubmitError("Unable to sign up. Please try again.");
          return;
        }
      }

      if (mode === "log-in") {
        try {
          const response = await fetch("/api/auth/log-in", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username: normalizedUsername,
              password,
            }),
          });

          const payload = (await response.json()) as {
            error?: string;
            username?: string;
          };
          if (!response.ok) {
            setSubmitError(payload.error ?? "Unable to log in. Please try again.");
            return;
          }
        } catch {
          setSubmitError("Unable to log in. Please try again.");
          return;
        }
      }

      window.localStorage.setItem("finops-auth-status", "signed-in");
      if (normalizedUsername) {
        window.localStorage.setItem("finops-auth-username", normalizedUsername);
      }

      if (normalizedUsername) {
        router.push(`/agent/${encodeURIComponent(normalizedUsername)}/dashboard`);
        return;
      }

      router.push("/agent/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-zinc-50 via-neutral-100 to-zinc-200 px-6 py-24 text-zinc-900">
      <section className="w-full max-w-xl rounded-2xl border border-black/10 bg-white/70 p-8 shadow-lg shadow-black/10 backdrop-blur">
        <h1 className="text-center text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-center text-sm text-zinc-600">{subtitle}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          {mode === "log-in" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700">
                Username
              </span>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black/35"
                placeholder="Enter your username"
                required
              />
            </label>
          ) : null}

          {mode === "sign-up" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700">
                Name
              </span>
              <input
                type="text"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black/35"
                placeholder="Enter your name"
                required
              />
            </label>
          ) : null}

          {mode === "sign-up" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700">
                Username
              </span>
              <input
                type="text"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black/35"
                placeholder="Choose a username"
                required
              />
            </label>
          ) : null}

          {mode === "sign-up" ? (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700">
                Mobile Number
              </span>
              <input
                type="tel"
                name="mobileNumber"
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value)}
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black/35"
                placeholder="Enter your mobile number"
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-700">
              Password
            </span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black/35"
              placeholder="Enter your password"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full cursor-pointer rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? mode === "sign-up"
                ? "Saving..."
                : "Logging in..."
              : submitLabel}
          </button>

          {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}
        </form>

        <p className="mt-5 text-center text-xs text-zinc-600">
          {alternatePrompt}{" "}
          <Link href={alternateHref} className="font-semibold text-zinc-900 underline">
            {alternateLabel}
          </Link>
        </p>
      </section>
    </main>
  );
}
