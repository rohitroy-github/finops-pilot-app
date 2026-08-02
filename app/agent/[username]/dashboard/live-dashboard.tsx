"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EventLogEntry } from "@/app/utils/eventLogger";
import CardsPanel from "@/app/components/dashboard/CardsPanel";
import DashboardPanelTabs, {
  type DashboardPanel,
} from "@/app/components/dashboard/DashboardPanelTabs";
import EventsPanel from "@/app/components/dashboard/EventsPanel";
import MandatesPanel from "@/app/components/dashboard/MandatesPanel";
import {
  cancelPaymentSession,
  deriveLiveEvents,
  fetchPastEventsByUsername,
  fetchLogSnapshot,
  fetchPravaSession,
  formatTime,
  mergeEventLogs,
  type PastEventCard,
} from "@/app/utils/liveDashboard";

type LiveDashboardProps = {
  username: string;
};

export default function LiveDashboard({ username }: LiveDashboardProps) {
  const [activePanel, setActivePanel] = useState<DashboardPanel>("events");
  const [logs, setLogs] = useState<EventLogEntry[]>([]);
  const [pastEvents, setPastEvents] = useState<PastEventCard[]>([]);
  const [connectionState, setConnectionState] = useState<
    "Connecting" | "Connected" | "Polling" | "Disconnected"
  >("Connecting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionIframeUrl, setSessionIframeUrl] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    const loadPastEvents = async () => {
      const dbEvents = await fetchPastEventsByUsername(username);
      if (cancelled || !dbEvents) {
        return;
      }

      setPastEvents(dbEvents);
    };

    void loadPastEvents();

    return () => {
      cancelled = true;
    };
  }, [username]);

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
        setConnectionState("Connected");
        mergeLogs(logsSnapshot);
      } catch {
        setConnectionState((currentState) =>
          currentState === "Connected" ? currentState : "Disconnected",
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
        setConnectionState("Connecting");
        eventSource = new EventSource("/api/logs/stream");

        eventSource.onopen = () => {
          setConnectionState("Connected");
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
          setConnectionState("Polling");
        };

        void pollLogs();
        poller = setInterval(() => {
          void pollLogs();
        }, 2000);
      } catch {
        if (!cancelled) {
          setConnectionState("Disconnected");
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
      return;
    }

    setSessionIframeUrl(null);
    setSessionId(null);
    setIsManuallyCancelled(true);

    appendLocalLog("success", "Payment session manually cancelled", {
      stage: "manual_cancelled",
      sessionId: result.sessionId,
      status: "manually_cancelled",
    });
  };

  return (
    <section className="grid gap-6 px-1 sm:px-2 md:grid-cols-[3fr_2fr]">
      <article className="rounded-2xl bg-black/3 p-6 sm:p-7">
        <DashboardPanelTabs
          activePanel={activePanel}
          onChange={setActivePanel}
        />

        <div className="mt-4">
          {activePanel === "events" ? (
            <EventsPanel
              events={events}
              pastEvents={pastEvents}
              isManuallyCancelled={isManuallyCancelled}
            />
          ) : null}
          {activePanel === "cards" ? <CardsPanel /> : null}
          {activePanel === "mandates" ? <MandatesPanel /> : null}
        </div>
      </article>

      <article className="rounded-2xl bg-black/3 p-6 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex w-full items-center justify-between gap-2 rounded-xl bg-black/6 p-3.5">
            <h2 className="text-xs font-semibold tracking-wide">Active Logs</h2>
            <div className="ml-auto flex items-center gap-2 text-xs tracking-wide text-black/70">
              <span>{connectionState}</span>
              <span
                className={`inline-block h-1.5 w-1.5 animate-pulse rounded-full ${
                  connectionState === "Disconnected"
                    ? "bg-red-500"
                    : connectionState === "Polling"
                      ? "bg-yellow-400"
                      : "bg-emerald-500"
                }`}
                aria-hidden="true"
              />
            </div>
          </div>
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
      </article>
    </section>
  );
}
