import type {
  Request,
  Response,
} from "express";

import {
  GetSupplementalRedCards,
} from "../../application/use-cases/GetSupplementalRedCards";

export class SupplementalRedCardsController {
  constructor(
    private readonly getSupplementalRedCards:
      GetSupplementalRedCards
  ) {}

  public list =
    async (
      _request:
        Request,

      response:
        Response
    ) => {

      try {
        const items =
          await this
            .getSupplementalRedCards
            .execute();

        response.json({
          count:
            items.length,

          items,

          fetchedAt:
            new Date()
              .toISOString(),
        });
      } catch (
        error
      ) {

        console.error(
          "[SupplementalRedCardsController]",
          error
        );

        /*
         * Fail-soft.
         *
         * Para un radar secundario
         * preferimos [] a tumbar la app.
         */
        response.json({
          count:
            0,

          items:
            [],

          fetchedAt:
            new Date()
              .toISOString(),

          degraded:
            true,
        });
      }
    };
}
