import type {
  Request,
  Response,
} from "express";

import type {
  RadarReviewStatus,
} from "../../domain/entities/RadarReview";

import type {
  GetRadarReviews,
} from "../../application/use-cases/GetRadarReviews";

import type {
  SetRadarReview,
} from "../../application/use-cases/SetRadarReview";

import type {
  ResetRadarReview,
} from "../../application/use-cases/ResetRadarReview";

export class RadarReviewController {
  constructor(
    private readonly getReviews:
      GetRadarReviews,

    private readonly setReview:
      SetRadarReview,

    private readonly resetReview:
      ResetRadarReview
  ) {}

  public list =
    async (
      _req:
        Request,

      res:
        Response
    ) => {

      const items =
        await this.getReviews
          .execute();

      return res.json({
        items,
      });
    };

  public set =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      const provider =
        String(
          req.params.provider ??
            ""
        );

      const externalId =
        String(
          req.params.externalId ??
            ""
        );

      const status =
        req.body
          ?.status as
          | RadarReviewStatus
          | undefined;

      if (
        !provider ||
        !externalId
      ) {
        return res
          .status(400)
          .json({
            message:
              "provider and externalId are required",
          });
      }

      if (
        status !==
          "marked" &&
        status !==
          "reviewed" &&
        status !==
          "dismissed"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid review status",
          });
      }

      const item =
        await this.setReview
          .execute(
            provider,
            externalId,
            status
          );

      return res.json({
        item,
      });
    };

  public reset =
    async (
      req:
        Request,

      res:
        Response
    ) => {

      const provider =
        String(
          req.params.provider ??
            ""
        );

      const externalId =
        String(
          req.params.externalId ??
            ""
        );

      await this.resetReview
        .execute(
          provider,
          externalId
        );

      return res.status(
        204
      ).send();
    };
}
