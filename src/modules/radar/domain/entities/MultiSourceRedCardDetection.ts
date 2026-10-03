import type {
  FootballProviderId,
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

export type RedCardConfidence =
  | "high"
  | "medium"
  | "low";

export interface NormalizedRedCardEvent {
  provider:
    FootballProviderId;

  externalEventId:
    string | null;

  side:
    "home"
    | "away"
    | null;

  minute:
    number | null;

  addedTime:
    number | null;

  playerId:
    string | null;

  playerName:
    string | null;

  type:
    "red"
    | "second-yellow-red"
    | "unknown-red";
}

export interface MultiSourceRedCardDetection {
  match:
    LiveMatch;

  homeRedCards:
    number;

  awayRedCards:
    number;

  totalRedCards:
    number;

  sources:
    FootballProviderId[];

  confidence:
    RedCardConfidence;

  events:
    NormalizedRedCardEvent[];
}
