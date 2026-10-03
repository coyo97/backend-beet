import type {
  MatchSource,
} from "../entities/LiveMatch";

import type {
  MatchIncident,
} from "../entities/MatchIncident";

export interface MatchIncidentProvider {
  supports(
    source: MatchSource
  ): boolean;

  getIncidents(
    source: MatchSource
  ): Promise<MatchIncident[]>;
}
