import type {
  TeamMatchContext,
} from "../../../match-context/domain/entities/MatchContext";

import type {
  OpponentDifficultySummary,
} from "../entities/MatchOpponentAnalysis";

export class OpponentStrengthAnalyzer {

  public analyze(
    team:
      TeamMatchContext,

    limit =
      5
  ): OpponentDifficultySummary {

    const recent =
      team.recentMatches
        .slice(
          0,
          limit
        );

    const positions =
      recent
        .map(
          match =>
            match.opponentPosition
        )
        .filter(
          (
            position
          ): position is number =>
            typeof position ===
              "number" &&
            Number.isFinite(
              position
            ) &&
            position >
              0
        )
        .sort(
          (
            a,
            b
          ) =>
            a -
            b
        );

    return {
      sampleSize:
        recent.length,

      rankedSampleSize:
        positions.length,

      unrankedCount:
        recent.length -
        positions.length,

      averagePosition:
        this.average(
          positions
        ),

      medianPosition:
        this.median(
          positions
        ),

      top3Count:
        positions.filter(
          value =>
            value <=
            3
        ).length,

      top5Count:
        positions.filter(
          value =>
            value <=
            5
        ).length,

      top10Count:
        positions.filter(
          value =>
            value <=
            10
        ).length,
    };
  }

  private average(
    values:
      number[]
  ): number |
    null {

    if (
      values.length ===
      0
    ) {
      return null;
    }

    const value =
      values.reduce(
        (
          total,
          item
        ) =>
          total +
          item,
        0
      ) /
      values.length;

    return Math.round(
      value *
      10
    ) /
      10;
  }

  private median(
    values:
      number[]
  ): number |
    null {

    if (
      values.length ===
      0
    ) {
      return null;
    }

    const middle =
      Math.floor(
        values.length /
        2
      );

    if (
      values.length %
        2 !==
      0
    ) {
      return values[
        middle
      ];
    }

    return (
      values[
        middle -
        1
      ] +
      values[
        middle
      ]
    ) /
      2;
  }
}
