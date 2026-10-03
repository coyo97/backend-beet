import type {
  Request,
  Response,
} from "express";

import type {
  GetRedCardMatches,
} from "../../application/use-cases/GetRedCardMatches";

import type {
  AnalyzeMatchPressure,
} from "../../application/use-cases/AnalyzeMatchPressure";

import type {
  GetRedCardPressureSignals,
} from "../../application/use-cases/GetRedCardPressureSignals";

import type {
  RadarSignalStore,
} from "../../application/ports/RadarSignalStore";

export class RadarController {
  constructor(
    private readonly getRedCardMatches:
      GetRedCardMatches,
	  private readonly analyzeMatchPressure:
    AnalyzeMatchPressure,
	  private readonly getRedCardPressureSignals:
    GetRedCardPressureSignals,
	    private readonly signalStore:
    RadarSignalStore
  ) {}

  public getRedCards =
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
          await this
            .getRedCardMatches
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
      } catch (error) {
        console.error(
          "[RadarController.getRedCards]",
          error
        );

        return res
          .status(500)
          .json({
            message:
              "Could not scan red-card matches",
          });
      }
    };
	public getPressure =
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

      const analysis =
        await this
          .analyzeMatchPressure
          .execute({
            provider:
              "flashscore",

            externalId:
              id,
          });

      if (!analysis) {
        return res
          .status(200)
          .json({
            matchId:
              id,

            provider:
              "flashscore",

            available:
              false,

            analysis:
              null,
          });
      }

      return res
        .status(200)
        .json({
          matchId:
            id,

          provider:
            "flashscore",

          available:
            true,

          analysis,
        });
    } catch (error) {
      console.error(
        "[RadarController.getPressure]",
        error
      );

      return res
        .status(502)
        .json({
          message:
            "Could not analyze match pressure",
        });
    }
  };
public getRedCardPressure =
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

      const signals =
        await this
          .getRedCardPressureSignals
          .execute({
            country,
          });

      return res
        .status(200)
        .json({
          count:
            signals.length,

          filters: {
            country:
              country ??
              null,
          },

          signals,
        });
    } catch (error) {
      console.error(
        "[RadarController.getRedCardPressure]",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Could not scan red-card pressure signals",
        });
    }
  };
  public getRecentSignals =
  async (
    req: Request,
    res: Response
  ): Promise<Response> => {

    const rawLimit =
      typeof req.query.limit ===
      "string"
        ? Number(
            req.query.limit
          )
        : 50;

    const limit =
      Number.isFinite(
        rawLimit
      )
        ? Math.max(
            1,
            Math.min(
              rawLimit,
              200
            )
          )
        : 50;

    const signals =
      this.signalStore
        .listRecent(
          limit
        );

    return res
      .status(200)
      .json({
        count:
          signals.length,

        signals,
      });
  };
}
