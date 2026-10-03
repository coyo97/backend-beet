import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MatchIncident,
} from "../../../football/domain/entities/MatchIncident";

import type {
  PressureAnalysis,
} from "./PressureAnalysis";

export type FieldSide =
  | "home"
  | "away";

export type RadarSignalStrength =
  | "clear"
  | "strong";

export interface RedCardPressureSignal {
  type:
    "RED_CARD_PRESSURE";

  match:
    LiveMatch;

  disadvantagedSide:
    FieldSide;

  advantagedSide:
    FieldSide;

  playerAdvantage:
    number;

  redCards: {
    home: number;
    away: number;

    verifiedPlayerIncidents:
      MatchIncident[];
  };

  pressure:
    PressureAnalysis;

  strength:
    RadarSignalStrength;

  reasonCodes: [
    "PLAYER_RED_CARD_IMBALANCE",
    "ADVANTAGED_SIDE_DOMINATING"
  ];
}
