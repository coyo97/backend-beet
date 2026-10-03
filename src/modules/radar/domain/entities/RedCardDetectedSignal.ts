import type {
  FootballProviderId,
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

export type RedCardAffectedSide =
  | "home"
  | "away"
  | "both"
  | "unknown";

export interface RedCardDetectedSignal {
  type:
    "red-card-detected";

  id:
    string;

  fingerprint:
    string;

  match:
    LiveMatch;

  redCards: {
    home:
      number;

    away:
      number;

    unknown:
      number;

    total:
      number;
  };

  affectedSide:
    RedCardAffectedSide;

  providers:
    FootballProviderId[];

  detectedAt:
    string;
}
