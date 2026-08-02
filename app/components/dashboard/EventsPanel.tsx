import { useState } from "react";
import type { LiveEventCard, PastEventCard } from "@/app/utils/liveDashboard";
import { formatTime } from "@/app/utils/liveDashboard";

type EventsPanelProps = {
  events: LiveEventCard[];
  pastEvents: PastEventCard[];
  isManuallyCancelled: boolean;
};

export default function EventsPanel({
  events,
  pastEvents,
  isManuallyCancelled,
}: EventsPanelProps) {
  const [visiblePastCount, setVisiblePastCount] = useState(2);

  if (pastEvents.length === 0 && events.length === 0) {
    return (
      <div className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-sm font-semibold">Events</p>
        <p className="mt-1 text-sm text-black/70">
          No live or past events found for this user yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
          Live Event
        </p>
        {events.length > 0 ? (
          events.map((event) => (
            <div
              key={event.id}
              className="relative rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4"
            >
              <p className="absolute right-4 top-3 text-xs text-black/60 sm:right-5 sm:top-4">
                {formatTime(event.receivedAt)}
              </p>
              <p className="text-sm font-semibold">{event.dependency}</p>
              <p className="mt-1 text-sm">
                Status: {isManuallyCancelled ? "Manually cancelled" : event.status}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-sm text-black/70">
              No live events yet. New events will appear here automatically.
            </p>
          </div>
        )}
      </div>

      {pastEvents.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
            Past Events
          </p>
          {pastEvents.slice(0, visiblePastCount).map((event) => (
            <div
              key={`past-${event.id}`}
              className="relative rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4"
            >
              <p className="absolute right-4 top-3 text-xs text-black/60 sm:right-5 sm:top-4">
                {formatTime(event.receivedAt)}
              </p>
              <p className="text-sm font-semibold">{event.dependency}</p>
              <p className="mt-1 text-sm">Incoming status: {event.incidentStatus}</p>
              <p className="mt-1 text-sm">
                Amount: ₹{event.paymentAmount.toFixed(2)}
              </p>
              <p className="mt-1 text-sm">Payment status: {event.paymentStatus}</p>
            </div>
          ))}
          {pastEvents.length > visiblePastCount ? (
            <button
              type="button"
              onClick={() => setVisiblePastCount((current) => current + 2)}
              className="text-left text-sm text-black/50 transition-colors hover:text-black/70 cursor-pointer"
            >
              Load more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
