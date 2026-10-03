import type {
  MatchStatisticMetric,
  MatchStatistics,
} from "../../../football/domain/entities/MatchStatistics";

import type {
  AnalysisConfidence,
  DominantSide,
  PressureAnalysis,
  PressureComponent,
  PressureLevel,
} from "../entities/PressureAnalysis";

interface MetricDefinition {
  key: string;

  label: string;

  weight: number;

  aliases:
    string[];
}

export class PressureAnalyzer {
  private readonly definitions:
    MetricDefinition[] = [
      {
        key: "xg",
        label:
          "Expected Goals",

        weight:
          0.30,

        aliases: [
          "expected_goals_xg",
          "expected_goals",
          "xg",
        ],
      },

      {
        key:
          "shots_on_target",

        label:
          "Shots on Target",

        weight:
          0.25,

        aliases: [
          "shots_on_goal",
          "shots_on_target",
          "shots_on_goal_attempts",
        ],
      },

      {
        key:
          "goal_attempts",

        label:
          "Goal Attempts",

        weight:
          0.15,

        aliases: [
          "goal_attempts",
          "total_shots",
          "shots",
        ],
      },

      {
        key:
          "dangerous_attacks",

        label:
          "Dangerous Attacks",

        weight:
          0.10,

        aliases: [
          "dangerous_attacks",
        ],
      },

      {
        key:
          "possession",

        label:
          "Possession",

        weight:
          0.10,

        aliases: [
          "ball_possession",
          "possession",
        ],
      },

      {
        key:
          "corners",

        label:
          "Corners",

        weight:
          0.10,

        aliases: [
          "corner_kicks",
          "corners",
        ],
      },
    ];

  public analyze(
    statistics:
      MatchStatistics
  ): PressureAnalysis {

    const components:
      PressureComponent[] = [];

    for (
      const definition
      of this.definitions
    ) {
      const metric =
        this.findMetric(
          statistics.metrics,
          definition.aliases
        );

      if (!metric) {
        continue;
      }

      const home =
        metric.home.numeric;

      const away =
        metric.away.numeric;

      if (
        home === null ||
        away === null
      ) {
        continue;
      }

      const total =
        home + away;

      if (
        total <= 0
      ) {
        continue;
      }

      const homeShare =
        (
          home /
          total
        ) * 100;

      const awayShare =
        (
          away /
          total
        ) * 100;

      components.push({
        metric:
          definition.key,

        label:
          metric.label,

        weight:
          definition.weight,

        homeValue:
          home,

        awayValue:
          away,

        homeShare:
          this.round(
            homeShare
          ),

        awayShare:
          this.round(
            awayShare
          ),
      });
    }

    const availableWeight =
      components.reduce(
        (
          total,
          component
        ) =>
          total +
          component.weight,

        0
      );

    if (
      availableWeight === 0
    ) {
      return {
        homeScore: 50,
        awayScore: 50,

        difference: 0,

        dominantSide:
          null,

        level:
          "balanced",

        confidence:
          "low",

        availableWeight:
          0,

        components: [],
      };
    }

    const homeWeighted =
      components.reduce(
        (
          total,
          component
        ) =>
          total +
          (
            component.homeShare *
            component.weight
          ),

        0
      );

    const homeScore =
      homeWeighted /
      availableWeight;

    const awayScore =
      100 -
      homeScore;

    const difference =
      homeScore -
      awayScore;

    const dominantSide =
      this.getDominantSide(
        difference
      );

    const level =
      this.getLevel(
        difference
      );

    return {
      homeScore:
        this.round(
          homeScore
        ),

      awayScore:
        this.round(
          awayScore
        ),

      difference:
        this.round(
          difference
        ),

      dominantSide,

      level,

      confidence:
        this.getConfidence(
          availableWeight
        ),

      availableWeight:
        this.round(
          availableWeight
        ),

      components,
    };
  }

  private findMetric(
    metrics:
      MatchStatisticMetric[],

    aliases:
      string[]
  ):
    MatchStatisticMetric |
    undefined {

    return metrics.find(
      (metric) =>
        aliases.includes(
          metric.key
        )
    );
  }

  private getDominantSide(
    difference: number
  ): DominantSide {

    if (
      Math.abs(
        difference
      ) < 8
    ) {
      return null;
    }

    return difference > 0
      ? "home"
      : "away";
  }

  private getLevel(
    difference: number
  ): PressureLevel {

    const value =
      Math.abs(
        difference
      );

    if (value < 8) {
      return "balanced";
    }

    if (value < 18) {
      return "slight";
    }

    if (value < 30) {
      return "clear";
    }

    return "strong";
  }

  private getConfidence(
    weight: number
  ): AnalysisConfidence {

    if (
      weight >= 0.75
    ) {
      return "high";
    }

    if (
      weight >= 0.40
    ) {
      return "medium";
    }

    return "low";
  }

  private round(
    value: number
  ): number {

    return Math.round(
      value * 10
    ) / 10;
  }
}
