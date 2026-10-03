import type {
  GetLiveMatches,
} from "../../../football/application/use-cases/GetLiveMatches";

import type {
  MatchIncidentProvider,
} from "../../../football/domain/providers/MatchIncidentProvider";

import type {
  LiveMatch,
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  RedCardRadarMatch,
} from "../../domain/entities/RedCardRadarMatch";

import {
  RedCardDetector,
} from "../../domain/services/RedCardDetector";

export interface RedCardRadarFilters {
  country?: string;
}

export class GetRedCardMatches {
  constructor(
    private readonly getLiveMatches:
      GetLiveMatches,

    private readonly incidentProvider:
      MatchIncidentProvider,

    private readonly detector:
      RedCardDetector =
        new RedCardDetector()
  ) {}

  public async execute(
    filters:
      RedCardRadarFilters = {}
  ): Promise<
    RedCardRadarMatch[]
  > {

    const matches =
      await this.getLiveMatches
        .execute({
          country:
            filters.country,
        });

    const candidates =
      matches.filter(
        (match) =>
          this.findSupportedSource(
            match
          ) !== null
      );

    const result:
      RedCardRadarMatch[] = [];

    const concurrency = 5;

    for (
      let index = 0;
      index < candidates.length;
      index += concurrency
    ) {
      const chunk =
        candidates.slice(
          index,
          index + concurrency
        );

      const scanned =
        await Promise.all(
          chunk.map(
            (match) =>
              this.scanMatch(
                match
              )
          )
        );

      for (
        const item
        of scanned
      ) {
        if (item) {
          result.push(
            item
          );
        }
      }
    }

    return result;
  }

  private findSupportedSource(
    match: LiveMatch
  ): MatchSource | null {

    return (
      match.sources.find(
        (source) =>
          this.incidentProvider
            .supports(source)
      ) ??
      null
    );
  }

  private async scanMatch(
    match: LiveMatch
  ): Promise<
    RedCardRadarMatch | null
  > {

    const source =
      this.findSupportedSource(
        match
      );

    if (!source) {
      return null;
    }

    try {
      const incidents =
        await this
          .incidentProvider
          .getIncidents(
            source
          );

      const redCards =
        incidents.filter(
          (incident) =>
            this.detector
              .isRedCard(
                incident
              )
        );

      if (
        redCards.length === 0
      ) {
        return null;
      }

      const home =
        redCards.filter(
          (incident) =>
            incident.side ===
            "home"
        ).length;

      const away =
        redCards.filter(
          (incident) =>
            incident.side ===
            "away"
        ).length;

      const unknown =
        redCards.length -
        home -
        away;

      return {
        match: {
          ...match,

          dataAvailability: {
            ...match
              .dataAvailability,

            events: true,
            redCards: true,
          },
        },

        redCards: {
          home,
          away,
          unknown,
          incidents:
            redCards,
        },
      };
    } catch (error) {
      console.error(
        "[GetRedCardMatches]",
        source.externalId,
        error
      );

      return null;
    }
  }
}
