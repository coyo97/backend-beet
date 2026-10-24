import type {
  LiveMatch,
  MatchSource,
} from "../../domain/entities/LiveMatch";

import type {
  MatchEventSnapshot,
} from "../../domain/entities/MatchEventSnapshot";

import type {
  MatchIncidentProvider,
} from "../../domain/providers/MatchIncidentProvider";

import type {
  MatchEventStore,
} from "../ports/MatchEventStore";

const SOURCE_PRIORITY =
  [
    "flashscore",
    "sofascore",
  ] as const;

export class CaptureMatchEvents {

  constructor(
    private readonly incidentProvider:
      MatchIncidentProvider,

    private readonly store:
      MatchEventStore
  ) {}

  public async execute(
    match:
      LiveMatch
  ): Promise<
    MatchEventSnapshot |
    null
  > {

    const source =
      this.selectSource(
        match
      );

    /*
     * No tenemos una fuente de incidents
     * compatible.
     *
     * Cero peticiones.
     */
    if (!source) {
      return null;
    }

    const incidents =
      await this
        .incidentProvider
        .getIncidents(
          source
        );

    const capturedAt =
      new Date()
        .toISOString();

    const snapshot:
      MatchEventSnapshot =
      {
        sourceKeys:
          match.sources
            .map(
              item =>
                this.sourceKey(
                  item
                )
            ),

        incidentSource: {
          provider:
            source.provider,

          externalId:
            source.externalId,
        },

        kickoffAt:
          match.kickoffAt,

        status: {
          long:
            match.status.long,

          short:
            match.status.short,

          minute:
            match.status.minute,
        },

        competition: {
          id:
            match.competition.id,

          name:
            match.competition.name,

          country:
            match.competition.country,

          season:
            match.competition.season,

          round:
            match.competition.round,
        },

        home: {
          id:
            match.home.id,

          name:
            match.home.name,

          goals:
            match.home.goals,
        },

        away: {
          id:
            match.away.id,

          name:
            match.away.name,

          goals:
            match.away.goals,
        },

        incidents,

        capturedAt,
      };

    await this.store
      .upsert(
        snapshot
      );

    return snapshot;
  }

  private selectSource(
    match:
      LiveMatch
  ): MatchSource |
    null {

    /*
     * Flashscore primero porque actualmente
     * su incidente puede traer marcador
     * homeScore / awayScore.
     */
    for (
      const provider
      of SOURCE_PRIORITY
    ) {

      const source =
        match.sources
          .find(
            candidate =>
              candidate.provider ===
                provider &&
              this.incidentProvider
                .supports(
                  candidate
                )
          );

      if (source) {
        return source;
      }
    }

    /*
     * Dejamos esto preparado para futuros
     * providers de incidents.
     */
    return (
      match.sources
        .find(
          source =>
            this.incidentProvider
              .supports(
                source
              )
        ) ??
      null
    );
  }

  private sourceKey(
    source:
      MatchSource
  ): string {

    return (
      `${source.provider}:` +
      source.externalId
    );
  }
}
