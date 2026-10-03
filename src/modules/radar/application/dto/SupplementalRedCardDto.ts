import type {
  FootballProviderId,
} from "../../../football/domain/entities/LiveMatch";

export interface SupplementalRedCardEventDto {
  provider:
    FootballProviderId;

  side:
    "home"
    | "away"
    | null;

  minute:
    number | null;

  addedTime:
    number | null;

  playerName:
    string | null;

  type:
    "red"
    | "second-yellow-red"
    | "unknown-red";
}

export interface SupplementalRedCardDto {
  match: {
    kickoffAt:
      string;

    status: {
      long:
        string;

      short:
        string;

      minute:
        number | null;
    };

    competition: {
      name:
        string;

      country:
        string;
    };

    home: {
      name:
        string;

      goals:
        number | null;

      redCards:
        number;
    };

    away: {
      name:
        string;

      goals:
        number | null;

      redCards:
        number;
    };

    sources:
      Array<{
        provider:
          FootballProviderId;

        externalId:
          string;
      }>;
  };

  detection: {
    totalRedCards:
      number;

    confidence:
      "high"
      | "medium"
      | "low";

    providers:
      FootballProviderId[];

    events:
      SupplementalRedCardEventDto[];
  };
}
