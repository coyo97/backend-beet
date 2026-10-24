import type {
  TeamLateGoalProfile,
} from "../../domain/entities/TeamLateGoalProfile";

import type {
  GetTeamLateGoalProfile,
} from "./GetTeamLateGoalProfile";

export interface GetLateGoalComparisonInput {
  homeTeamName:
    string;

  awayTeamName:
    string;

  limit?:
    number;
}

export interface LateGoalComparison {
  home:
    TeamLateGoalProfile;

  away:
    TeamLateGoalProfile;

  availability: {
    has80DataForBoth:
      boolean;

    has90DataForBoth:
      boolean;
  };
}

export class GetLateGoalComparison {

  constructor(
    private readonly getTeamLateGoalProfile:
      GetTeamLateGoalProfile
  ) {}

  public async execute(
    input:
      GetLateGoalComparisonInput
  ): Promise<
    LateGoalComparison
  > {

    const homeTeamName =
      input.homeTeamName
        .trim();

    const awayTeamName =
      input.awayTeamName
        .trim();

    if (
      !homeTeamName ||
      !awayTeamName
    ) {
      throw new Error(
        "homeTeamName and awayTeamName are required"
      );
    }

    const limit =
      Math.min(
        Math.max(
          input.limit ??
            50,
          1
        ),
        500
      );

    /*
     * Ambas consultas son únicamente
     * contra Mongo local.
     */
    const [
      home,
      away,
    ] =
      await Promise.all([
        this
          .getTeamLateGoalProfile
          .execute(
            homeTeamName,
            limit
          ),

        this
          .getTeamLateGoalProfile
          .execute(
            awayTeamName,
            limit
          ),
      ]);

    return {
      home,

      away,

      availability: {
        has80DataForBoth:
          home.matchesObserved80 >
            0 &&
          away.matchesObserved80 >
            0,

        has90DataForBoth:
          home.matchesObserved90 >
            0 &&
          away.matchesObserved90 >
            0,
      },
    };
  }
}
