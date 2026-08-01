type DashboardPanel = "events" | "cards" | "mandates";

type DashboardPanelTabsProps = {
  activePanel: DashboardPanel;
  onChange: (panel: DashboardPanel) => void;
};

export type { DashboardPanel };

export default function DashboardPanelTabs({
  activePanel,
  onChange,
}: DashboardPanelTabsProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/6 p-2">
      <button
        type="button"
        onClick={() => onChange("events")}
        className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
          activePanel === "events"
            ? "bg-black text-white"
            : "text-black/80 hover:bg-black/10"
        }`}
      >
        Events
      </button>

      <button
        type="button"
        onClick={() => onChange("mandates")}
        className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
          activePanel === "mandates"
            ? "bg-black text-white"
            : "text-black/80 hover:bg-black/10"
        }`}
      >
        Active Mandates
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors ${
          activePanel === "cards"
            ? "bg-black text-white"
            : "text-black/80 hover:bg-black/10"
        }`}
      >
        My Cards
      </button>
    </div>
  );
}
