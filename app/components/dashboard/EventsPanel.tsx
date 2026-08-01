import type { LiveEventCard } from "@/app/utils/liveDashboard";
import { formatTime } from "@/app/utils/liveDashboard";

type EventsPanelProps = {
  events: LiveEventCard[];
  isManuallyCancelled: boolean;
};

export default function EventsPanel({
  events,
  isManuallyCancelled,
}: EventsPanelProps) {
  if (events.length === 0) {
    return (

    <div className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-sm font-semibold">Events</p>
      <p className="mt-1 text-sm text-black/70">
        No live events have been received yet. Once events are received, they
        will appear here.
      </p>
    </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4"
        >
          <p className="text-sm font-semibold">{event.dependency}</p>
          <p className="mt-1 text-sm">
            Status: {isManuallyCancelled ? "Manually cancelled" : event.status}
          </p>
          <p className="mt-1 text-xs text-black/70">
            Received: {formatTime(event.receivedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
