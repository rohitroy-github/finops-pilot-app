"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PravaSDK } from "@prava-sdk/core";
import type { EventLogEntry } from "@/app/utils/eventLogger";
import {
  cancelPaymentSession,
  deriveLiveEvents,
  fetchLogSnapshot,
  fetchPravaSession,
  formatTime,
  mergeEventLogs,
} from "@/app/utils/liveDashboard";

export default function LiveDashboard() {
  const [logs, setLogs] = useState<EventLogEntry[]>([]);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "polling" | "disconnected"
  >("connecting");
  const [cardStatus, setCardStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [cardMessage, setCardMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionIframeUrl, setSessionIframeUrl] = useState<string | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const pravaRef = useRef<PravaSDK | null>(null);
  const sessionHydrationAttemptedRef = useRef(false);
  const [isManuallyCancelled, setIsManuallyCancelled] = useState(false);

  const loadPravaSession = async () => {
    const data = await fetchPravaSession();
    if (!data) {
      return null;
    }

    setIsManuallyCancelled(false);

    if (data.sessionId) {
      setSessionId(data.sessionId);
    }

    if (data.iframeUrl) {
      setSessionIframeUrl(data.iframeUrl);
    }

    return data;
  };

  const mergeLogs = (incoming: EventLogEntry[]) => {
    setLogs((current) => mergeEventLogs(current, incoming, 120));
  };

  const appendLocalLog = (
    level: EventLogEntry["level"],
    message: string,
    data?: Record<string, unknown>,
  ) => {
    mergeLogs([
      {
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        level,
        message,
        data,
      },
    ]);
  };

  // Set up the EventSource connection and polling mechanism to receive live logs from the server. This effect runs once on component mount and cleans up on unmount.
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let poller: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const pollLogs = async () => {
      try {
        const logsSnapshot = await fetchLogSnapshot();
        if (!logsSnapshot) {
          return;
        }
        setConnectionState("connected");
        mergeLogs(logsSnapshot);
      } catch {
        setConnectionState((currentState) =>
          currentState === "connected" ? currentState : "disconnected",
        );
      }
    };

    const initialize = async () => {
      try {
        await fetch("/api/logs", { method: "DELETE", cache: "no-store" });
        if (cancelled) {
          return;
        }

        setLogs([]);
        setConnectionState("connecting");
        eventSource = new EventSource("/api/logs/stream");

        eventSource.onopen = () => {
          setConnectionState("connected");
        };

        eventSource.onmessage = (event) => {
          try {
            const entry = JSON.parse(event.data) as EventLogEntry;
            mergeLogs([entry]);
          } catch {
            // Ignore malformed events.
          }
        };

        eventSource.onerror = () => {
          setConnectionState("polling");
        };

        void pollLogs();
        poller = setInterval(() => {
          void pollLogs();
        }, 2000);
      } catch {
        if (!cancelled) {
          setConnectionState("disconnected");
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      if (poller) {
        clearInterval(poller);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const events = useMemo(() => deriveLiveEvents(logs), [logs]);
  const hasPravaSessionCreated = useMemo(
    () => logs.some((entry) => entry.data?.stage === "prava_session_created"),
    [logs],
  );

  // Determine if the merchant payment process has started based on the logs. This is used to conditionally render UI elements related to the payment process, such as buttons for approving or cancelling the payment.
  const hasMerchantPaymentStarted = useMemo(
    () => logs.some((entry) => entry.data?.stage === "merchant_payment_start"),
    [logs],
  );

  // Determine the outcome of the merchant payment based on the logs. This is used to display the current status of the payment process in the UI.
  const merchantPaymentOutcome = useMemo(() => {
    const completeLog = logs.find(
      (entry) => entry.data?.stage === "merchant_payment_complete",
    );
    if (completeLog) {
      const outcome = completeLog.data?.outcome;
      return outcome === "success"
        ? "success"
        : outcome === "failed"
          ? "failed"
          : "submitted";
    }
    if (logs.some((entry) => entry.data?.stage === "merchant_payment_error")) {
      return "failed";
    }
    return null;
  }, [logs]);

  // Hydrate the Prava session on component mount if it hasn't been created yet. This ensures that the session is ready for collecting card details or approving payments.
  useEffect(() => {
    if (!hasPravaSessionCreated || sessionIframeUrl) {
      return;
    }

    // Prevent duplicate hydration calls while still allowing retry if no iframe URL is returned.
    if (sessionHydrationAttemptedRef.current) {
      return;
    }

    sessionHydrationAttemptedRef.current = true;

    void loadPravaSession().then((data) => {
      if (!data?.iframeUrl) {
        sessionHydrationAttemptedRef.current = false;
      }
    });
  }, [hasPravaSessionCreated, sessionIframeUrl]);

  // Initialize the Prava SDK on component mount and clean up on unmount.
  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_PRAVA_PUBLISHABLE_KEY;
    if (!publishableKey) {
      setCardStatus("error");
      setCardMessage(
        "Missing NEXT_PUBLIC_PRAVA_PUBLISHABLE_KEY in environment.",
      );
      return;
    }

    pravaRef.current = new PravaSDK({ publishableKey });

    return () => {
      pravaRef.current?.destroy();
      pravaRef.current = null;
    };
  }, []);

  // const handleCollectCard = async () => {
  //   if (!pravaRef.current || !cardContainerRef.current) {
  //     setCardStatus("error");
  //     setCardMessage("Prava card form is not ready yet.");
  //     return;
  //   }

  //   setCardStatus("loading");
  //   setCardMessage("Creating session and loading secure card form...");

  //   try {
  //     const data = await loadPravaSession();

  //     if (!data?.sessionToken || !data.iframeUrl) {
  //       throw new Error("Could not load Prava session");
  //     }

  //     setSessionIframeUrl(data.iframeUrl);

  //     await pravaRef.current.collectPAN({
  //       sessionToken: data.sessionToken,
  //       iframeUrl: data.iframeUrl,
  //       container: cardContainerRef.current,
  //       onReady: () => {
  //         setCardMessage(
  //           "Secure card form loaded. Enter card details and approve with passkey.",
  //         );
  //       },
  //       onSuccess: (card) => {
  //         setCardStatus("success");
  //         setCardMessage(`Card collected: ${card.brand} •••• ${card.last4}`);
  //       },
  //       onError: (err) => {
  //         setCardStatus("error");
  //         setCardMessage(`${err.code}: ${err.message}`);
  //       },
  //     });
  //   } catch (error) {
  //     setCardStatus("error");
  //     setCardMessage(
  //       error instanceof Error ? error.message : "Card collection failed",
  //     );
  //   }
  // };

  // Open the Prava payment iframe in a new browser tab/window. This is useful for testing the payment flow in a separate context, especially if the embedded iframe is not working as expected or if you want to simulate a user approving the payment in a real browser environment.
  const handleOpenIframeInNewTab = () => {
    if (!sessionIframeUrl) {
      return;
    }

    window.open(sessionIframeUrl, "_blank", "noopener,noreferrer");
  };

  // Trigger manual payment cancellation, then reset local session/UI state.
  const handleCancelPayment = async () => {
    const result = await cancelPaymentSession(sessionId);

    if (!result.ok) {
      setCardStatus("error");
      setCardMessage(result.message);
      return;
    }

    setSessionIframeUrl(null);
    setSessionId(null);
    setIsManuallyCancelled(true);
    setCardStatus("idle");
    setCardMessage(result.message);

    appendLocalLog("success", "Payment session manually cancelled", {
      stage: "manual_cancelled",
      sessionId: result.sessionId,
      status: "manually_cancelled",
    });
  };

  return (
    <section className="grid gap-6 px-1 sm:px-2 md:grid-cols-[3fr_2fr]">
      <article className="rounded-2xl bg-black/3 p-6 sm:p-7">
        <h2 className="text-lg font-semibold">Events</h2>
        <div className="mt-4 space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-black/70">No live events yet.</p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4"
              >
                <p className="text-sm font-semibold">{event.dependency}</p>
                <p className="mt-1 text-sm">
                  Status:{" "}
                  {isManuallyCancelled ? "Manually cancelled" : event.status}
                </p>
                <p className="mt-1 text-xs text-black/70">
                  Received: {formatTime(event.receivedAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </article>

      <article className="rounded-2xl bg-black/3 p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Logs</h2>
          <span className="text-xs uppercase tracking-wide text-black/70">
            {connectionState}
          </span>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4">
          {logs.length === 0 ? (
            <p className="text-sm text-black/70">No live incidents yet</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {logs.map((log) => (
                <li key={log.id}>
                  <span className="font-semibold">[{formatTime(log.ts)}]</span>{" "}
                  [{log.level}] {log.message}
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasPravaSessionCreated && !hasMerchantPaymentStarted ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleOpenIframeInNewTab}
                disabled={!sessionIframeUrl}
                className="w-full rounded-lg bg-black/10 px-3 py-2 text-xs font-medium text-black cursor-pointer disabled:opacity-50"
              >
                Approve Payment
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCancelPayment();
                }}
                disabled={!sessionId}
                className="w-full rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-800 cursor-pointer disabled:opacity-50"
              >
                Cancel Payment
              </button>
            </div>
          </div>
        ) : null}

        {hasMerchantPaymentStarted ? (
          <div
            className={`mt-4 rounded-lg px-3 py-2.5 text-xs font-medium ${
              merchantPaymentOutcome === "success"
                ? "bg-green-100 text-green-800"
                : merchantPaymentOutcome === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-black/5 text-black/70"
            }`}
          >
            {merchantPaymentOutcome === "success"
              ? "Merchant payment completed successfully."
              : merchantPaymentOutcome === "failed"
                ? "Merchant payment failed."
                : merchantPaymentOutcome === "submitted"
                  ? "Payment submitted — awaiting confirmation."
                  : "Processing merchant payment…"}
          </div>
        ) : null}

        {/* {hasPravaSessionCreated ? (
          <div className="mt-5 rounded-xl bg-white px-4 py-4 sm:px-5 sm:py-5">
            <h3 className="text-sm font-semibold">Collect Card Details</h3>
            <p className="mt-1 text-xs text-black/70">
              Embedded mode using Prava collectPAN. The card number stays inside
              Prava&apos;s secure iframe.
            </p>

            <div
              ref={cardContainerRef}
              className="mt-3 min-h-28 rounded-lg bg-black/3 p-2"
            />

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCollectCard}
                // disabled={cardStatus === 'loading'}
                disabled={true}
                className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cardStatus === "loading"
                  ? "Loading..."
                  : "Collect card securely"}
              </button>
              <span className="text-xs uppercase tracking-wide text-black/60">
                {cardStatus}
              </span>
            </div>

            {cardMessage ? (
              <p className="mt-2 text-xs text-black/70">{cardMessage}</p>
            ) : null}
          </div>
        ) : null} */}
      </article>
    </section>
  );
}
