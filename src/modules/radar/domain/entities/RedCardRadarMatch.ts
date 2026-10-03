import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MatchIncident,
} from "../../../football/domain/entities/MatchIncident";

export interface RedCardRadarMatch {
  match: LiveMatch;

  redCards: {
    home: number;
    away: number;
    unknown: number;

    incidents:
      MatchIncident[];
  };
}
