import type {
  MatchIncident,
} from "./MatchIncident";

import type {
  FootballProviderId,
} from "./LiveMatch";

export interface MatchEventSnapshot {
  sourceKeys:
    string[];

  incidentSource: {
    provider:
      FootballProviderId;

    externalId:
      string;
  };

  kickoffAt:
    string;

  status: {
    long:
      string;

    short:
      string;

    minute:
      number |
      null;
  };

  competition: {
    id:
      string |
      null;

    name:
      string;

    country:
      string;

    season:
      string |
      null;

    round:
      string |
      null;
  };

  home: {
    id:
      string |
      null;

    name:
      string;

    goals:
      number |
      null;
  };

  away: {
    id:
      string |
      null;

    name:
      string;

    goals:
      number |
      null;
  };

  incidents:
    MatchIncident[];

  capturedAt:
    string;
}
