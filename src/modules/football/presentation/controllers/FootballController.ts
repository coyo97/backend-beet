import type {
  Request,
  Response,
} from "express";

import type {
  GetLiveMatches,
} from "../../application/use-cases/GetLiveMatches";

import type {
  GetMatchStatistics,
} from "../../application/use-cases/GetMatchStatistics";

export class FootballController {
  constructor(
    private readonly getLiveMatches:
      GetLiveMatches,
  private readonly getMatchStatistics:
    GetMatchStatistics
  ) {}

public getLive =
  async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    try {
      const country =
        typeof req.query.country ===
        "string"
          ? req.query.country
          : undefined;

      const matches =
        await this.getLiveMatches
          .execute({
            country,
          });

      return res.status(200).json({
        count:
          matches.length,

        filters: {
          country:
            country ?? null,
        },

        matches,
      });
    } catch (error) {
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

  public getStatistics =
  async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    try {
      const rawId =
  req.params.id;

const id =
  Array.isArray(rawId)
    ? rawId[0]
    : rawId;

if (!id) {
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
    } catch (error) {
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

}
