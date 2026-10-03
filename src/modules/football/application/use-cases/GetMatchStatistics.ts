import type {
  MatchSource,
} from "../../domain/entities/LiveMatch";

import type {
  MatchStatistics,
} from "../../domain/entities/MatchStatistics";

import type {
  MatchStatisticsProvider,
} from "../../domain/providers/MatchStatisticsProvider";

export class GetMatchStatistics {
  constructor(
    private readonly provider:
      MatchStatisticsProvider
  ) {}

  public execute(
    source: MatchSource
  ): Promise<
    MatchStatistics[]
  > {

    return this.provider
      .getStatistics(
        source
      );
  }
}
