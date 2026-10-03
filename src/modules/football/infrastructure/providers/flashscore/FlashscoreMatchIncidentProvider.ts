import type {
  MatchSource,
} from "../../../domain/entities/LiveMatch";

import type {
  MatchIncident,
} from "../../../domain/entities/MatchIncident";

import type {
  MatchIncidentProvider,
} from "../../../domain/providers/MatchIncidentProvider";

import {
  FlashscoreClient,
} from "./FlashscoreClient";

import type {
  FlashscoreSummaryResponse,
} from "./FlashscoreSummaryTypes";

export class FlashscoreMatchIncidentProvider
  implements MatchIncidentProvider
{
  constructor(
    private readonly client:
      FlashscoreClient =
        new FlashscoreClient()
  ) {}

  public supports(
    source: MatchSource
  ): boolean {

    return (
      source.provider ===
      "flashscore"
    );
  }

  public async getIncidents(
    source: MatchSource
  ): Promise<MatchIncident[]> {

    if (
      !this.supports(source)
    ) {
      return [];
    }

    const data =
      await this.client.get<
        FlashscoreSummaryResponse
      >(
        "/matches/summary",
        {
          match:
            source.externalId,
        }
      );

    return (
      data.periods ?? []
    ).flatMap(
      (period) =>
        (
          period.incidents ??
          []
        ).map(
          (incident):
            MatchIncident => ({
              id:
                incident.id ??
                null,

              side:
                incident.team ??
                null,

              minute:
                incident.minute ??
                null,

              minuteNumber:
                incident
                  .minute_number ??
                null,

              type:
                incident.type ??
                null,

              reason:
                incident.reason ??
                null,

              description:
                incident
                  .description ??
                null,

              player:
                incident.player
                  ? {
                      id:
                        incident
                          .player
                          .id ??
                        null,

                      name:
                        incident
                          .player
                          .name ??
                        null,
                    }
                  : null,

              homeScore:
                incident
                  .home_score ??
                null,

              awayScore:
                incident
                  .away_score ??
                null,
            })
        )
    );
  }
}
