import type {
  Request,
  Response,
} from "express";

import {
  GetUnifiedRedCards,
} from "../../application/use-cases/GetUnifiedRedCards";

export class UnifiedRedCardsController {
  constructor(
    private readonly getUnifiedRedCards:
      GetUnifiedRedCards
  ) {}

  public list =
    async (
      _request:
        Request,

      response:
        Response
    ) => {

      try {
        const result =
          await this
            .getUnifiedRedCards
            .execute();

        response.json({
          ...result,

          fetchedAt:
            new Date()
              .toISOString(),
        });
      } catch (
        error
      ) {

        console.error(
          "[UnifiedRedCardsController]",
          error
        );

        response.status(
          500
        ).json({
          originalCount:
            0,

          supplementalCount:
            0,

          mergedCount:
            0,

          items:
            [],

          degraded:
            true,

          fetchedAt:
            new Date()
              .toISOString(),
        });
      }
    };
}
