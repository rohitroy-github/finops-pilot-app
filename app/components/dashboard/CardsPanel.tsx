"use client";

import { useEffect, useState } from "react";

type CardMetadata = {
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
};

type CardItem = {
  card_id: string;
  card_last4: string;
  card_brand: string;
  card_exp_month: number;
  card_exp_year: number;
  masked_card_number: string;
  metadata?: CardMetadata;
  is_default: boolean;
  status: string;
  created_at: string;
};

type ListCardsResponse = {
  cards: CardItem[];
  count: number;
};

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function CardsPanel() {
  const [cards, setCards] = useState<CardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          "/api/prava/list-cards?status=active",
          { cache: "no-store" },
        );

        const data = (await response.json()) as Partial<ListCardsResponse> & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to fetch cards");
        }

        if (!cancelled) {
          setCards(Array.isArray(data.cards) ? data.cards : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch cards");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCards();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl bg-white px-4 py-3 sm:px-5 sm:py-4">
      <p className="text-sm font-semibold">My Saved Cards</p>

      {isLoading ? (
        <p className="mt-2 text-sm text-black/70">Loading cards...</p>
      ) : error ? (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      ) : cards.length === 0 ? (
        <p className="mt-2 text-sm text-black/70">No active cards found.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {cards.map((card) => {
            return (
              <li
                key={card.card_id}
                className="rounded-lg border border-black/10 bg-black/85 px-3 py-2.5 text-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-white/70">
                    {card.card_brand}
                  </span>
                  {card.is_default ? (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-semibold tracking-wider">{card.masked_card_number}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/70">
                  <p>
                    Exp {String(card.card_exp_month).padStart(2, "0")}/{card.card_exp_year}
                  </p>
                  <p>Created {formatCreatedAt(card.created_at)}</p>
                </div>
                <p className="mt-1 text-[11px] text-white/55">ID: {card.card_id}</p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] tracking-wide text-black/50">These are demo VISA cards shared by Prava</p>
    </div>
  );
}
