import type {
  Request,
  Response,
} from "express";

import type {
  GetRedCardDetectedSignals,
} from "../../application/use-cases/GetRedCardDetectedSignals";

export class RedCardDetectedController {
  constructor(
    private readonly getSignals:
      GetRedCardDetectedSignals
  ) {}

  public list =
    async (
      request:
        Request,

      response:
        Response
    ) => {

      try {

        const country =
          typeof request
            .query
            .country ===
          "string"
            ? request
                .query
                .country
            : undefined;

        const signals =
          await this
            .getSignals
            .execute({
              country,
            });

        response.json({
          count:
            signals.length,

          signals,

          fetchedAt:
            new Date()
              .toISOString(),
        });

      } catch (
        error
      ) {

        console.error(
          "[RedCardDetectedController]",
          error
        );

        response
          .status(
            500
          )
          .json({
            count:
              0,

            signals:
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
