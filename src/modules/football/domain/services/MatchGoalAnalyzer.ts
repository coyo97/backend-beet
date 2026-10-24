import type {
  MatchIncident,
  MatchSide,
} from "../entities/MatchIncident";

import type {
  GoalEvent,
  GoalScorerSummary,
  MatchGoalAnalysis,
  TeamGoalTimingSummary,
} from "../entities/MatchGoalAnalysis";

import {
  GoalIncidentClassifier,
} from "./GoalIncidentClassifier";

export class MatchGoalAnalyzer {

  constructor(
    private readonly classifier:
      GoalIncidentClassifier =
        new GoalIncidentClassifier()
  ) {}

  public analyze(
    incidents:
      MatchIncident[]
  ): MatchGoalAnalysis {

    const events =
      incidents
        .filter(
          incident =>
            this.classifier
              .isGoal(
                incident
              )
        )
        .map(
          incident =>
            this.toGoalEvent(
              incident
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            (
              a.effectiveMinute ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              b.effectiveMinute ??
              Number.MAX_SAFE_INTEGER
            )
        );

    const homeEvents =
      events.filter(
        event =>
          event.side ===
          "home"
      );

    const awayEvents =
      events.filter(
        event =>
          event.side ===
          "away"
      );

    return {
      totalGoals:
        events.length,

      late80Goals:
        events.filter(
          event =>
            event.late80
        ).length,

      late90Goals:
        events.filter(
          event =>
            event.late90
        ).length,

      home:
        this.teamSummary(
          homeEvents
        ),

      away:
        this.teamSummary(
          awayEvents
        ),

      unknownSideGoals:
        events.filter(
          event =>
            event.side ===
            null
        ).length,

      events,
    };
  }

  private toGoalEvent(
    incident:
      MatchIncident
  ): GoalEvent {

    const minute =
      this.classifier
        .parseMinute(
          incident
        );

    const effectiveMinute =
      minute.effectiveMinute;

    return {
      incidentId:
        incident.id,

      side:
        incident.side,

      minute:
        incident.minute,

      minuteNumber:
        incident.minuteNumber,

      effectiveMinute,

      addedTime:
        minute.addedTime,

      late80:
        effectiveMinute !==
          null &&
        effectiveMinute >=
          80,

      late90:
        effectiveMinute !==
          null &&
        effectiveMinute >=
          90,

      player:
        incident.player,

      reason:
        incident.reason,

      description:
        incident.description,

      homeScore:
        incident.homeScore,

      awayScore:
        incident.awayScore,
    };
  }

  private teamSummary(
    events:
      GoalEvent[]
  ): TeamGoalTimingSummary {

    return {
      total:
        events.length,

      late80:
        events.filter(
          event =>
            event.late80
        ).length,

      late90:
        events.filter(
          event =>
            event.late90
        ).length,

      scorers:
        this.scorers(
          events
        ),
    };
  }

  private scorers(
    events:
      GoalEvent[]
  ): GoalScorerSummary[] {

    const map =
      new Map<
        string,
        GoalScorerSummary
      >();

    for (
      const event
      of events
    ) {

      const playerId =
        event.player
          ?.id ??
        null;

      const playerName =
        event.player
          ?.name ??
        null;

      const key =
        playerId ??
        playerName ??
        "unknown";

      const current =
        map.get(
          key
        ) ?? {
          playerId,

          playerName,

          goals:
            0,

          late80Goals:
            0,

          late90Goals:
            0,
        };

      current.goals +=
        1;

      if (
        event.late80
      ) {
        current
          .late80Goals +=
          1;
      }

      if (
        event.late90
      ) {
        current
          .late90Goals +=
          1;
      }

      map.set(
        key,
        current
      );
    }

    return Array.from(
      map.values()
    )
      .sort(
        (
          a,
          b
        ) =>
          b.goals -
          a.goals
      );
  }
}
