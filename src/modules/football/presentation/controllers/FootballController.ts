import type {
  Request,
  Response,
} from "express";

import type {
  GetLiveMatches,
} from "../../application/use-cases/GetLiveMatches";

import type {
  GetTeamLateGoalProfile,
} from "../../application/use-cases/GetTeamLateGoalProfile";

import type {
  GetLateGoalProfilesForTeams,
} from "../../application/use-cases/GetLateGoalProfilesForTeams";

import type {
  GetMatchStatistics,
} from "../../application/use-cases/GetMatchStatistics";
import type {
  GetLateGoalComparison,
} from "../../application/use-cases/GetLateGoalComparison";

import type {
  GetRecentMatches,
} from "../../application/use-cases/GetRecentMatches";

export class FootballController {
  constructor(
    private readonly getLiveMatches:
      GetLiveMatches,

    private readonly getMatchStatistics:
      GetMatchStatistics,

    private readonly getRecentMatches:
      GetRecentMatches,

	 private readonly getTeamLateGoalProfile:
      GetTeamLateGoalProfile,

	   private readonly getLateGoalComparison:
    GetLateGoalComparison,

	   private readonly getLateGoalProfilesForTeams:
  GetLateGoalProfilesForTeams

  ) {}

  public getLive =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {
        const country =
          typeof req.query
            .country ===
          "string"
            ? req.query
                .country
            : undefined;

        const matches =
          await this
            .getLiveMatches
            .execute({
              country,
            });

        return res
          .status(200)
          .json({
            count:
              matches.length,

            filters: {
              country:
                country ??
                null,
            },

            matches,
          });
      } catch (
        error
      ) {

        console.error(
          "[FootballController.getLive]",
          error
        );

        return res
          .status(502)
          .json({
            message:
              "Could not retrieve live matches",
          });
      }
    };

  public getRecent =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {
        const rawHours =
          typeof req.query
            .hours ===
          "string"
            ? Number(
                req.query
                  .hours
              )
            : undefined;

        const rawLimit =
          typeof req.query
            .limit ===
          "string"
            ? Number(
                req.query
                  .limit
              )
            : undefined;

        const matches =
          await this
            .getRecentMatches
            .execute({
              hours:
                rawHours,

              limit:
                rawLimit,
            });

        return res
          .status(200)
          .json({
            count:
              matches.length,

            matches,
          });
      } catch (
        error
      ) {

        console.error(
          "[FootballController.getRecent]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not retrieve recent matches",
          });
      }
    };

  public getStatistics =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {
        const rawId =
          req.params.id;

        const id =
          Array.isArray(
            rawId
          )
            ? rawId[0]
            : rawId;

        if (
          !id
        ) {
          return res
            .status(400)
            .json({
              message:
                "match id is required",
            });
        }

        const statistics =
          await this
            .getMatchStatistics
            .execute({
              provider:
                "flashscore",

              externalId:
                id,
            });

        return res
          .status(200)
          .json({
            matchId:
              id,

            provider:
              "flashscore",

            statistics,
          });
      } catch (
        error
      ) {

        console.error(
          "[FootballController.getStatistics]",
          error
        );

        return res
          .status(502)
          .json({
            message:
              "Could not retrieve match statistics",
          });
      }
    };

	  public getLateGoalProfile =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {
        const rawTeamName =
          req.params
            .teamName;

        const teamName =
          Array.isArray(
            rawTeamName
          )
            ? rawTeamName[0]
            : rawTeamName;

        if (
          !teamName ||
          !teamName.trim()
        ) {
          return res
            .status(400)
            .json({
              message:
                "team name is required",
            });
        }

        const rawLimit =
          typeof req.query
            .limit ===
          "string"
            ? Number(
                req.query
                  .limit
              )
            : undefined;

        if (
          rawLimit !==
            undefined &&
          (
            !Number.isFinite(
              rawLimit
            ) ||
            rawLimit <=
              0
          )
        ) {
          return res
            .status(400)
            .json({
              message:
                "limit must be a positive number",
            });
        }

        const profile =
          await this
            .getTeamLateGoalProfile
            .execute(
              teamName,
              rawLimit !==
                undefined
                ? Math.floor(
                    rawLimit
                  )
                : 50
            );

        return res
          .status(200)
          .json(
            profile
          );
      } catch (
        error
      ) {

        console.error(
          "[FootballController.getLateGoalProfile]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not retrieve team late goal profile",
          });
      }
    };
	public getLateGoalComparisonProfile =
  async (
    req:
      Request,

    res:
      Response
  ): Promise<
    Response
  > => {

    try {
      const home =
        typeof req.query.home ===
        "string"
          ? req.query.home
              .trim()
          : "";

      const away =
        typeof req.query.away ===
        "string"
          ? req.query.away
              .trim()
          : "";

      if (
        !home ||
        !away
      ) {
        return res
          .status(400)
          .json({
            message:
              "home and away are required",
          });
      }

      const rawLimit =
        typeof req.query.limit ===
        "string"
          ? Number(
              req.query.limit
            )
          : undefined;

      if (
        rawLimit !==
          undefined &&
        (
          !Number.isFinite(
            rawLimit
          ) ||
          rawLimit <=
            0
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "limit must be a positive number",
          });
      }

      const comparison =
        await this
          .getLateGoalComparison
          .execute({
            homeTeamName:
              home,

            awayTeamName:
              away,

            limit:
              rawLimit !==
                undefined
                ? Math.floor(
                    rawLimit
                  )
                : 50,
          });

      return res
        .status(200)
        .json(
          comparison
        );
    } catch (
      error
    ) {

      console.error(
        "[FootballController.getLateGoalComparisonProfile]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Could not retrieve late goal comparison",
        });
    }
  };
  public getLateGoalProfiles =
  async (
    req:
      Request,

    res:
      Response
  ): Promise<
    Response
  > => {

    try {
      const rawTeamNames =
        req.body
          ?.teamNames;

      if (
        !Array.isArray(
          rawTeamNames
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "teamNames must be an array",
          });
      }

      const teamNames =
        rawTeamNames
          .filter(
            (
              value
            ): value is string =>
              typeof value ===
                "string"
          )
          .map(
            value =>
              value.trim()
          )
          .filter(
            Boolean
          );

      if (
        teamNames.length ===
        0
      ) {
        return res
          .status(400)
          .json({
            message:
              "at least one team name is required",
          });
      }

      /*
       * Protección para que un cliente
       * no mande miles de nombres.
       *
       * Las tarjetas visibles normalmente
       * serán muchas menos.
       */
      if (
        teamNames.length >
        100
      ) {
        return res
          .status(400)
          .json({
            message:
              "maximum 100 teams per request",
          });
      }

      const rawLimit =
        typeof req.body
          ?.limit ===
          "number"
          ? req.body.limit
          : 50;

      if (
        !Number.isFinite(
          rawLimit
        ) ||
        rawLimit <=
          0
      ) {
        return res
          .status(400)
          .json({
            message:
              "limit must be a positive number",
          });
      }

      const profiles =
        await this
          .getLateGoalProfilesForTeams
          .execute(
            teamNames,
            Math.floor(
              rawLimit
            )
          );

      return res
        .status(200)
        .json({
          count:
            profiles.length,

          profiles,
        });
    } catch (
      error
    ) {

      console.error(
        "[FootballController.getLateGoalProfiles]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Could not retrieve late goal profiles",
        });
    }
  };
}
