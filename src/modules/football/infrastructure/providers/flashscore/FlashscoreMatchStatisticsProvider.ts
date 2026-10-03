import type {
  MatchSource,
} from "../../../domain/entities/LiveMatch";

import type {
  MatchStatistics,
} from "../../../domain/entities/MatchStatistics";

import type {
  MatchStatisticsProvider,
} from "../../../domain/providers/MatchStatisticsProvider";

import {
  FlashscoreClient,
} from "./FlashscoreClient";

import {
  FlashscoreStatisticsParser,
} from "./FlashscoreStatisticsParser";

export class FlashscoreMatchStatisticsProvider
  implements MatchStatisticsProvider
{
  constructor(
    private readonly client:
      FlashscoreClient,

    private readonly parser =
      new FlashscoreStatisticsParser()
  ) {}

  public supports(
    source: MatchSource
  ): boolean {

    return (
      source.provider ===
      "flashscore"
    );
  }

  public async getStatistics(
    source: MatchSource
  ): Promise<
    MatchStatistics[]
  > {

    if (
      !this.supports(
        source
      )
    ) {
      return [];
    }

    const raw =
      await this.client.get<
        unknown
      >(
        "/matches/statistics",
        {
          match:
            source.externalId,
        }
      );

    const metrics =
      this.parser.parse(
        raw
      );

    return [
      {
        source,

        period:
          "all",

        metrics,
      },
    ];
  }
}
