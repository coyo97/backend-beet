export type FotMobRedCardSide =
  | "home"
  | "away"
  | null;

export type FotMobRedCardType =
  | "red"
  | "second-yellow-red"
  | "unknown-red";

export interface FotMobRedCardEvent {
  eventId:
    string | null;

  side:
    FotMobRedCardSide;

  minute:
    number | null;

  addedTime:
    number | null;

  playerId:
    string | null;

  playerName:
    string | null;

  type:
    FotMobRedCardType;
}

export interface FotMobRedCardSnapshot {
  homeRedCards:
    number | null;

  awayRedCards:
    number | null;

  totalRedCards:
    number;

  hasRedCard:
    boolean;

  events:
    FotMobRedCardEvent[];

  confidence:
    "high"
    | "medium"
    | "unknown";

  fetchedAt:
    string;
}
