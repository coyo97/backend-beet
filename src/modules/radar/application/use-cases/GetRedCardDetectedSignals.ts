import type {
  FootballProviderId,
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  RedCardRadarMatch,
} from "../../domain/entities/RedCardRadarMatch";

import type {
  RedCardDetectedSignal,
  RedCardAffectedSide,
} from "../../domain/entities/RedCardDetectedSignal";

export interface RedCardDetectedFilters {
  country?: string;
}

interface RedCardMatchesSource {
  execute(
    filters?:
      RedCardDetectedFilters
  ): Promise<
    RedCardRadarMatch[]
  >;
}

export class GetRedCardDetectedSignals {
  constructor(
    private readonly source:
      RedCardMatchesSource
  ) {}

  public async execute(
    filters:
      RedCardDetectedFilters = {}
  ): Promise<
    RedCardDetectedSignal[]
  > {

    const matches =
      await this.source
        .execute(
          filters
        );

    const signals:
      RedCardDetectedSignal[] =
        [];

    for (
      const item
      of matches
    ) {

      const home =
        item.redCards.home;

      const away =
        item.redCards.away;

      const unknown =
        item.redCards.unknown;

      const total =
        home +
        away +
        unknown;

      if (
        total <=
        0
      ) {
        continue;
      }

      const matchKey =
        this.buildMatchKey(
          item.match
        );

      signals.push({
        type:
          "red-card-detected",

        id:
          `${matchKey}:red-card-detected`,

        fingerprint:
          [
            home,
            away,
            unknown,
          ].join(
            ":"
          ),

        match:
          item.match,

        redCards: {
          home,
          away,
          unknown,
          total,
        },

        affectedSide:
          this.resolveAffectedSide(
            home,
            away,
            unknown
          ),

        providers:
          this.extractProviders(
            item.match
          ),

        detectedAt:
          new Date()
            .toISOString(),
      });
    }

    return signals;
  }

  private resolveAffectedSide(
    home:
      number,

    away:
      number,

    unknown:
      number
  ): RedCardAffectedSide {

    if (
      home >
        0 &&
      away >
        0
    ) {
      return "both";
    }

    if (
      home >
      0
    ) {
      return "home";
    }

    if (
      away >
      0
    ) {
      return "away";
    }

    if (
      unknown >
      0
    ) {
      return "unknown";
    }

    return "unknown";
  }

  private extractProviders(
    match:
      LiveMatch
  ): FootballProviderId[] {

    return Array.from(
      new Set(
        match.sources.map(
          (
            source
          ) =>
            source.provider
        )
      )
    );
  }

  private buildMatchKey(
    match:
      LiveMatch
  ): string {

    const priority:
      FootballProviderId[] =
      [
        "flashscore",
        "fotmob",
        "api-football",
        "bookmaker",
        "sofascore",
        "manual",
      ];

    for (
      const provider
      of priority
    ) {

      const source =
        match.sources.find(
          (
            item
          ) =>
            item.provider ===
            provider
        );

      if (source) {

        return [
          source.provider,
          source.externalId,
        ].join(
          ":"
        );
      }
    }

    return [
      this.normalize(
        match.home.name
      ),

      this.normalize(
        match.away.name
      ),

      match.kickoffAt,
    ].join(
      ":"
    );
  }

  private normalize(
    value:
      string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        "");
  }
}
