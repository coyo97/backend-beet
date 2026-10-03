import type {
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  GetMatchStatistics,
} from "../../../football/application/use-cases/GetMatchStatistics";

import type {
  PressureAnalysis,
} from "../../domain/entities/PressureAnalysis";

import {
  PressureAnalyzer,
} from "../../domain/services/PressureAnalyzer";

export class AnalyzeMatchPressure {
  constructor(
    private readonly getMatchStatistics:
      GetMatchStatistics,

    private readonly analyzer:
      PressureAnalyzer =
        new PressureAnalyzer()
  ) {}

  public async execute(
    source:
      MatchSource
  ): Promise<
    PressureAnalysis |
    null
  > {

    const statistics =
      await this
        .getMatchStatistics
        .execute(
          source
        );

    const selected =
      statistics.find(
        (item) =>
          item.period ===
          "all"
      ) ??
      statistics[0];

    if (
      !selected ||
      selected.metrics.length ===
        0
    ) {
      return null;
    }

    return this.analyzer
      .analyze(
        selected
      );
  }
}
