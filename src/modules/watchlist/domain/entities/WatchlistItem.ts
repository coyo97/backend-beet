export type WatchlistItemType =
  | "match"
  | "team"
  | "competition"
  | "country"
  | "radar-rule";

export interface WatchlistTarget {
  provider?: string | null;

  externalId?: string | null;

  name?: string | null;

  country?: string | null;

  competition?: string | null;

  homeName?: string | null;

  awayName?: string | null;

  kickoffAt?: string | null;
}

export interface WatchlistRadarRule {
  event:
    "RED_CARD_PRESSURE";

  country?:
    string;

  competition?:
    string;

  teamName?:
    string;

  minimumStrength?:
    | "clear"
    | "strong";

  minimumMinute?:
    number;

  maximumMinute?:
    number;

  minimumPressureScore?:
    number;

  teamMustHaveAdvantage?:
    boolean;
}

export interface WatchlistItem {
  id:
    string;

  type:
    WatchlistItemType;

  label:
    string;

  dedupKey:
    string;

  enabled:
    boolean;

  target:
    WatchlistTarget;

  rule?:
    WatchlistRadarRule |
    null;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface CreateWatchlistItemInput {
  type:
    WatchlistItemType;

  label:
    string;

  target:
    WatchlistTarget;

  rule?:
    WatchlistRadarRule |
    null;

  enabled?:
    boolean;
}
