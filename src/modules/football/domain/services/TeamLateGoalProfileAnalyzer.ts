import type {
  MatchEventSnapshot,
} from "../entities/MatchEventSnapshot";

import type {
  GoalScorerSummary,
} from "../entities/MatchGoalAnalysis";

import {
  GoalIncidentClassifier,
} from "./GoalIncidentClassifier";

import type {
  TeamLateGoalProfile,
  TeamLateGoalScorer,
} from "../entities/TeamLateGoalProfile";

import {
  MatchGoalAnalyzer,
} from "./MatchGoalAnalyzer";

type TeamSide =
  | "home"
  | "away";

export class TeamLateGoalProfileAnalyzer {

  constructor(
  private readonly goalAnalyzer:
    MatchGoalAnalyzer =
      new MatchGoalAnalyzer(),

  private readonly incidentClassifier:
    GoalIncidentClassifier =
      new GoalIncidentClassifier()
) {}

  public analyze(
    teamName:
      string,

    snapshots:
      MatchEventSnapshot[]
  ): TeamLateGoalProfile {

    let matchesTracked =
      0;

    let matchesObserved80 =
      0;

    let matchesObserved90 =
      0;

    let recordedGoalsScored =
      0;

    let recordedGoalsConceded =
      0;

    let late80Scored =
      0;

    let late80Conceded =
      0;

    let late90Scored =
      0;

    let late90Conceded =
      0;

    let matchesWithLate80Scored =
      0;

    let matchesWithLate80Conceded =
      0;

    let matchesWithLate90Scored =
      0;

    let matchesWithLate90Conceded =
      0;

    const scorers =
      new Map<
        string,
        TeamLateGoalScorer
      >();

    for (
      const snapshot
      of snapshots
    ) {

      const side =
        this.resolveTeamSide(
          teamName,
          snapshot
        );

      if (!side) {
        continue;
      }

      matchesTracked +=
        1;

      const goals =
        this.goalAnalyzer
          .analyze(
            snapshot.incidents
          );

      const teamGoals =
        side ===
          "home"
          ? goals.home
          : goals.away;

      const opponentGoals =
        side ===
          "home"
          ? goals.away
          : goals.home;

      recordedGoalsScored +=
        teamGoals.total;

      recordedGoalsConceded +=
        opponentGoals.total;

     const observedMinute =
  this.resolveObservedMinute(
    snapshot
  );

      const finished =
        this.isFinished(
          snapshot.status.short,
          snapshot.status.long
        );

      const observed80 =
        finished ||
        (
          observedMinute !==
            null &&
          observedMinute >=
            80
        );

      const observed90 =
        finished ||
        (
          observedMinute !==
            null &&
          observedMinute >=
            90
        );

      if (
        observed80
      ) {
        matchesObserved80 +=
          1;

        late80Scored +=
          teamGoals.late80;

        late80Conceded +=
          opponentGoals.late80;

        if (
          teamGoals.late80 >
          0
        ) {
          matchesWithLate80Scored +=
            1;
        }

        if (
          opponentGoals.late80 >
          0
        ) {
          matchesWithLate80Conceded +=
            1;
        }
      }

      if (
        observed90
      ) {
        matchesObserved90 +=
          1;

        late90Scored +=
          teamGoals.late90;

        late90Conceded +=
          opponentGoals.late90;

        if (
          teamGoals.late90 >
          0
        ) {
          matchesWithLate90Scored +=
            1;
        }

        if (
          opponentGoals.late90 >
          0
        ) {
          matchesWithLate90Conceded +=
            1;
        }
      }

      this.mergeScorers(
        scorers,
        teamGoals.scorers
      );
    }

    return {
      teamName,

      matchesTracked,

      matchesObserved80,

      matchesObserved90,

      recordedGoalsScored,

      recordedGoalsConceded,

      late80Scored,

      late80Conceded,

      late90Scored,

      late90Conceded,

      matchesWithLate80Scored,

      matchesWithLate80Conceded,

      matchesWithLate90Scored,

      matchesWithLate90Conceded,

      late80ScoringMatchRate:
        this.rate(
          matchesWithLate80Scored,
          matchesObserved80
        ),

      late80ConcedingMatchRate:
        this.rate(
          matchesWithLate80Conceded,
          matchesObserved80
        ),

      late90ScoringMatchRate:
        this.rate(
          matchesWithLate90Scored,
          matchesObserved90
        ),

      late90ConcedingMatchRate:
        this.rate(
          matchesWithLate90Conceded,
          matchesObserved90
        ),

      scorers:
        Array.from(
          scorers.values()
        )
          .sort(
            (
              a,
              b
            ) =>
              b.late80Goals -
                a.late80Goals ||
              b.goals -
                a.goals
          ),
    };
  }

  private resolveTeamSide(
    teamName:
      string,

    snapshot:
      MatchEventSnapshot
  ): TeamSide |
    null {

    const key =
      this.normalizeName(
        teamName
      );

    if (
      this.normalizeName(
        snapshot.home.name
      ) ===
      key
    ) {
      return "home";
    }

    if (
      this.normalizeName(
        snapshot.away.name
      ) ===
      key
    ) {
      return "away";
    }

    return null;
  }

private resolveObservedMinute(
  snapshot:
    MatchEventSnapshot
): number |
null {

  const values:
    number[] =
    [];

  /*
   * Minuto informado por el proveedor
   * live.
   */
  if (
    typeof snapshot
      .status.minute ===
      "number"
  ) {
    values.push(
      snapshot.status.minute
    );
  }

  /*
   * CUALQUIER incidente demuestra
   * hasta qué punto de la timeline
   * llegamos a observar.
   *
   * No solamente los goles.
   */
  for (
    const incident
    of snapshot.incidents
  ) {

    const parsed =
      this.incidentClassifier
        .parseMinute(
          incident
        );

    if (
      typeof parsed
        .effectiveMinute ===
        "number"
    ) {
      values.push(
        parsed.effectiveMinute
      );
    }
  }

  if (
    values.length ===
    0
  ) {
    return null;
  }

  return Math.max(
    ...values
  );
}

  private isFinished(
    short:
      string,

    long:
      string
  ): boolean {

    const shortKey =
      short
        .trim()
        .toLowerCase();

    if (
      [
        "ft",
        "aet",
        "pen",
      ].includes(
        shortKey
      )
    ) {
      return true;
    }

    const text =
      `${short} ${long}`
        .toLowerCase();

    return (
      text.includes(
        "finished"
      ) ||
      text.includes(
        "full time"
      ) ||
      text.includes(
        "after extra time"
      ) ||
      text.includes(
        "after penalties"
      )
    );
  }

  private mergeScorers(
    target:
      Map<
        string,
        TeamLateGoalScorer
      >,

    source:
      GoalScorerSummary[]
  ): void {

    for (
      const scorer
      of source
    ) {

      const key =
        scorer.playerId ??
        scorer.playerName ??
        "unknown";

      const current =
        target.get(
          key
        ) ?? {
          playerId:
            scorer.playerId,

          playerName:
            scorer.playerName,

          goals:
            0,

          late80Goals:
            0,

          late90Goals:
            0,
        };

      current.goals +=
        scorer.goals;

      current.late80Goals +=
        scorer.late80Goals;

      current.late90Goals +=
        scorer.late90Goals;

      target.set(
        key,
        current
      );
    }
  }

  private rate(
    matches:
      number,

    sample:
      number
  ): number |
    null {

    if (
      sample <=
      0
    ) {
      return null;
    }

    return Math.round(
      (
        matches /
        sample *
        100
      ) *
      10
    ) /
      10;
  }

  private normalizeName(
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
        " "
      )
      .trim()
      .replace(
        /\s+/g,
        " "
      );
  }
}
