"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type MandatePayload = {
  user_id: string;
  user_email: string;
  total_amount: string;
  currency: string;
  purchase_context: Array<{
    merchant_details: {
      name: string;
      url: string;
      country_code_iso2: string;
    };
    product_details: Array<{
      description: string;
      unit_price: string;
    }>;
  }>;
  mandate_setup: {
    intent: "mandate_setup";
    recurring_frequency: string;
    merchant_scope: string;
    max_charges: number;
  };
};

type UserMandate = {
  id: string;
  username: string;
  prava_user_id: string;
  merchant_name: string;
  total_amount: number;
  frequency: string;
  charges_total: number;
  charges_made: number;
  currency?: string;
  remaining?: string;
  created_at: string;
  updated_at: string;
};

export default function MandatesPanel() {
  const params = useParams<{ username?: string | string[] }>();
  const usernameParam = Array.isArray(params?.username)
    ? params.username[0]
    : params?.username;
  const normalizedUsername = usernameParam?.trim();

  const [showForm, setShowForm] = useState(false);
  const [approvalIframeUrl, setApprovalIframeUrl] = useState<string | null>(null);
  const [approvalSessionId, setApprovalSessionId] = useState<string | null>(null);
  const [mandates, setMandates] = useState<UserMandate[]>([]);
  const [isLoadingMandates, setIsLoadingMandates] = useState(false);
  const [mandatesError, setMandatesError] = useState<string | null>(null);

  const [userId, setUserId] = useState("user_123");
  const [userEmail, setUserEmail] = useState("jane@example.com");
  const [totalAmount, setTotalAmount] = useState("250.00");
  const [currency, setCurrency] = useState("INR");
  const [merchantName, setMerchantName] = useState("TranslateAI");
  const [merchantUrl, setMerchantUrl] = useState("https://acme.example.com");
  const [merchantCountryIso2, setMerchantCountryIso2] = useState("US");
  const [productDescription, setProductDescription] = useState("Monthly plan");
  const [unitPrice, setUnitPrice] = useState("25.00");
  const [recurringFrequency, setRecurringFrequency] = useState("weekly");
  const [merchantScope, setMerchantScope] = useState("listed");
  const [maxCharges, setMaxCharges] = useState(12);

  useEffect(() => {
    let cancelled = false;

    const loadDefaults = async () => {
      try {
        const response = await fetch("/api/mandate/defaults", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const defaults = (await response.json()) as {
          user_email?: string;
          total_amount?: string;
          currency?: string;
          merchant_name?: string;
          merchant_url?: string;
          merchant_country_code_iso2?: string;
          product_description?: string;
          unit_price?: string;
          recurring_frequency?: string;
          merchant_scope?: string;
          max_charges?: number;
        };

        if (cancelled) {
          return;
        }

        if (defaults.user_email) {
          setUserEmail(defaults.user_email);
        }
        if (defaults.total_amount) {
          setTotalAmount(defaults.total_amount);
        }
        if (defaults.currency) {
          setCurrency(defaults.currency);
        }
        if (defaults.merchant_name) {
          setMerchantName(defaults.merchant_name);
        }
        if (defaults.merchant_url) {
          setMerchantUrl(defaults.merchant_url);
        }
        if (defaults.merchant_country_code_iso2) {
          setMerchantCountryIso2(defaults.merchant_country_code_iso2);
        }
        if (defaults.product_description) {
          setProductDescription(defaults.product_description);
        }
        if (defaults.unit_price) {
          setUnitPrice(defaults.unit_price);
        }
        if (defaults.recurring_frequency) {
          setRecurringFrequency(defaults.recurring_frequency);
        }
        if (defaults.merchant_scope) {
          setMerchantScope(defaults.merchant_scope);
        }
        if (typeof defaults.max_charges === "number") {
          setMaxCharges(Math.max(0, defaults.max_charges));
        }
      } catch {
        // Keep local fallback values if defaults API is unavailable.
      }
    };

    void loadDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (normalizedUsername) {
      setUserId(normalizedUsername);
    }
  }, [normalizedUsername]);

  const inputClass =
    "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-xs outline-none transition focus:border-black/35";

  const loadMandates = async () => {
    if (!normalizedUsername) {
      setMandates([]);
      setMandatesError(null);
      return;
    }

    setIsLoadingMandates(true);
    setMandatesError(null);

    try {
      const response = await fetch(
        `/api/prava/mandate/list?username=${encodeURIComponent(normalizedUsername)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setMandatesError(body?.error ?? "Failed to load mandates");
        return;
      }

      const body = (await response.json()) as { mandates?: UserMandate[] };
      setMandates(Array.isArray(body.mandates) ? body.mandates : []);
    } catch {
      setMandatesError("Failed to load mandates");
    } finally {
      setIsLoadingMandates(false);
    }
  };

  useEffect(() => {
    void loadMandates();
  }, [normalizedUsername]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload: MandatePayload = {
      user_id: userId.trim(),
      user_email: userEmail.trim(),
      total_amount: totalAmount.trim(),
      currency: currency.trim().toUpperCase(),
      purchase_context: [
        {
          merchant_details: {
            name: merchantName.trim(),
            url: merchantUrl.trim(),
            country_code_iso2: merchantCountryIso2.trim().toUpperCase(),
          },
          product_details: [
            {
              description: productDescription.trim(),
              unit_price: unitPrice.trim(),
            },
          ],
        },
      ],
      mandate_setup: {
        intent: "mandate_setup",
        recurring_frequency: recurringFrequency.trim(),
        merchant_scope: merchantScope.trim(),
        max_charges: Number.isFinite(maxCharges) ? Math.max(0, maxCharges) : 0,
      },
    };

    try {
      const response = await fetch("/api/prava/mandate/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseBody = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        console.error("[mandates] Failed to create mandate payload", {
          status: response.status,
          error: responseBody?.error,
        });
        return;
      }

      const responseBody = (await response.json().catch(() => null)) as
        | {
            session?: {
              session_id?: string;
              iframe_url?: string;
            };
          }
        | null;

      const iframeUrl = responseBody?.session?.iframe_url?.trim();
      const sessionId = responseBody?.session?.session_id?.trim();
      setApprovalIframeUrl(iframeUrl || null);
      setApprovalSessionId(sessionId || null);

      console.log("[mandates] Create / Submit payload sent", payload);
      await loadMandates();
      setShowForm(false);
    } catch (error) {
      console.error("[mandates] Create mandate request failed", error);
    }
  };

  return (
    <div className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Mandates</p>
        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          className="cursor-pointer rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          {showForm ? "Hide Form" : "Create New Mandate"}
        </button>
      </div>

      {!showForm ? (
        <div className="mt-3 grid gap-2">
          {approvalIframeUrl ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-800">
                Mandate session created{approvalSessionId ? ` (${approvalSessionId})` : ""}. Click approve to continue.
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => window.open(approvalIframeUrl, "_blank", "noopener,noreferrer")}
                  className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                  Approve Mandate
                </button>
              </div>
            </div>
          ) : null}

          {isLoadingMandates ? (
            <p className="text-sm text-black/70">Loading mandates...</p>
          ) : mandatesError ? (
            <p className="text-sm text-red-600">{mandatesError}</p>
          ) : mandates.length === 0 ? (
            <p className="text-sm text-black/70">No mandates found for this user.</p>
          ) : (
            mandates.map((mandate) => (
              <article
                key={mandate.id}
                className="rounded-lg border border-black/10 bg-black/2 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-black">
                      {mandate.merchant_name}
                    </p>
                    <p className="text-[11px] text-black/70">
                      Mandate ID: {mandate.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-black">
                      {(mandate.currency ?? "USD").toUpperCase()} {Number(mandate.total_amount).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-black/75">
                      Charges: {mandate.charges_made}/{mandate.charges_total}
                    </p>
                    <p className="text-[11px] text-black/70">
                      Remaining: {mandate.remaining ?? "0.00"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-[11px] text-black/75 sm:grid-cols-2">
                  <p>Frequency: {mandate.frequency}</p>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                user_id
              </span>
              <input
                className={inputClass}
                value={userId}
                disabled
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                user_email
              </span>
              <input
                type="email"
                className={inputClass}
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                total_amount
              </span>
              <input
                className={inputClass}
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                currency
              </span>
              <input
                className={inputClass}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                required
              />
            </label>
          </div>

          <div className="rounded-lg border border-black/10 bg-black/2 p-3">
            <p className="text-xs font-semibold tracking-wide">purchase_context</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  merchant_details.name
                </span>
                <input
                  className={inputClass}
                  value={merchantName}
                  onChange={(event) => setMerchantName(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  merchant_details.url
                </span>
                <input
                  className={inputClass}
                  value={merchantUrl}
                  onChange={(event) => setMerchantUrl(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  merchant_details.country_code_iso2
                </span>
                <input
                  className={inputClass}
                  value={merchantCountryIso2}
                  onChange={(event) => setMerchantCountryIso2(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  product_details.description
                </span>
                <input
                  className={inputClass}
                  value={productDescription}
                  onChange={(event) => setProductDescription(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  product_details.unit_price
                </span>
                <input
                  className={inputClass}
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-black/10 bg-black/2 p-3">
            <p className="text-xs font-semibold tracking-wide">mandate_setup</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  intent
                </span>
                <input className={inputClass} value="mandate_setup" readOnly />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  recurring_frequency
                </span>
                <input
                  className={inputClass}
                  value={recurringFrequency}
                  onChange={(event) => setRecurringFrequency(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  merchant_scope
                </span>
                <input
                  className={inputClass}
                  value={merchantScope}
                  onChange={(event) => setMerchantScope(event.target.value)}
                  required
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-black/70">
                  max_charges
                </span>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={maxCharges}
                  onChange={(event) =>
                    setMaxCharges(Number.parseInt(event.target.value || "0", 10))
                  }
                  required
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Create Mandate
            </button>
          </div>

        </form>
      )}
    </div>
  );
}
