import type {
  TeamLateGoalProfile,
} from "../../domain/entities/TeamLateGoalProfile";

import {
  TeamLateGoalProfileAnalyzer,
} from "../../domain/services/TeamLateGoalProfileAnalyzer";

import type {
  MatchEventStore,
} from "../ports/MatchEventStore";

export class GetTeamLateGoalProfile {

  constructor(
    private readonly store:
      MatchEventStore,

    private readonly analyzer:
      TeamLateGoalProfileAnalyzer =
        new TeamLateGoalProfileAnalyzer()
  ) {}

  public async execute(
    teamName:
      string,

    limit =
      50
  ): Promise<
    TeamLateGoalProfile
  > {

    const normalizedName =
      teamName
        .trim();

    if (!normalizedName) {
      throw new Error(
        "teamName is required"
      );
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
        .findByTeam(
          normalizedName,
          normalizedLimit
        );

    return this.analyzer
      .analyze(
        normalizedName,
        snapshots
      );
  }
}
