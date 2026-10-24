import type {
  TeamLateGoalProfile,
} from "../../domain/entities/TeamLateGoalProfile";

import {
  TeamLateGoalProfileAnalyzer,
} from "../../domain/services/TeamLateGoalProfileAnalyzer";

import type {
  MatchEventStore,
} from "../ports/MatchEventStore";

export class GetLateGoalProfilesForTeams {

  constructor(
    private readonly store:
      MatchEventStore,

    private readonly analyzer:
      TeamLateGoalProfileAnalyzer =
        new TeamLateGoalProfileAnalyzer()
  ) {}

  public async execute(
    teamNames:
      string[],

    limit =
      50
  ): Promise<
    TeamLateGoalProfile[]
  > {

    const names =
      Array.from(
        new Set(
          teamNames
            .map(
              name =>
                name.trim()
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      names.length ===
      0
    ) {
      return [];
    }

    const normalizedLimit =
      Math.min(
        Math.max(
          limit,
          1
        ),
        500
      );

    const snapshots =
      await this.store
        .findByTeams(
          names,
          normalizedLimit
        );

    return names.map(
      teamName =>
        this.analyzer
          .analyze(
            teamName,
            snapshots
          )
    );
  }
}
