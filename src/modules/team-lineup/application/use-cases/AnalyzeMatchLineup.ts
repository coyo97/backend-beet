import type {
  MatchLineupSnapshot,
} from "../../domain/entities/MatchLineupSnapshot";

import type {
  MatchLineupAnalysis,
} from "../../domain/entities/LineupAnalysis";

import {
  TeamStarterProfiler,
} from "../../domain/services/TeamStarterProfiler";

import type {
  MatchLineupStore,
} from "../ports/MatchLineupStore";

export interface AnalyzeMatchLineupInput {
  lineup:
    MatchLineupSnapshot;

  historyLimit?:
    number;
}

export class AnalyzeMatchLineup {
  private readonly profiler =
    new TeamStarterProfiler();

  constructor(
    private readonly store:
      MatchLineupStore
  ) {}

  public async execute(
    input:
      AnalyzeMatchLineupInput
  ): Promise<
    MatchLineupAnalysis
  > {

    const lineup =
      input.lineup;

    const historyLimit =
      Math.min(
        Math.max(
          Number.isFinite(
            input.historyLimit
          )
            ? Number(
                input.historyLimit
              )
            : 8,
          1
        ),
        20
      );

    const [
      homeHistory,
      awayHistory,
    ] =
      await Promise.all([
        lineup.home
          .teamId
          ? this.store
              .findRecentConfirmedByTeam({
                provider:
                  lineup.provider,

                teamId:
                  lineup.home
                    .teamId,

                limit:
                  historyLimit,

                /*
                 * Importantísimo:
                 * el partido actual no
                 * forma parte de su propio
                 * historial.
                 */
                excludeSourceKey:
                  lineup.sourceKey,
              })
          : Promise.resolve(
              []
            ),

        lineup.away
          .teamId
          ? this.store
              .findRecentConfirmedByTeam({
                provider:
                  lineup.provider,

                teamId:
                  lineup.away
                    .teamId,

                limit:
                  historyLimit,

                excludeSourceKey:
                  lineup.sourceKey,
              })
          : Promise.resolve(
              []
            ),
      ]);

    return {
      sourceKey:
        lineup.sourceKey,

      historicalLimit:
        historyLimit,

      home:
        this.profiler
          .analyze(
            lineup.home,
            homeHistory
          ),

      away:
        this.profiler
          .analyze(
            lineup.away,
            awayHistory
          ),
    };
  }
}
