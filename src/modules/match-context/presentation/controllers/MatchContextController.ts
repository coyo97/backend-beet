import type {
  Request,
  Response,
} from "express";

import type {
  GetMatchContext,
} from "../../application/use-cases/GetMatchContext";

function queryString(
  value:
    unknown
): string | null {

  if (
    typeof value ===
    "string"
  ) {
    const trimmed =
      value.trim();

    return trimmed ||
      null;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    const first =
      value[0];

    if (
      typeof first ===
      "string"
    ) {
      const trimmed =
        first.trim();

      return trimmed ||
        null;
    }
  }

  return null;
}

export class MatchContextController {
  constructor(
    private readonly getMatchContext:
      GetMatchContext
  ) {}

  public get =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {
        const rawProvider =
          req.params.provider;

        const rawId =
          req.params.id;

        const provider =
          Array.isArray(
            rawProvider
          )
            ? rawProvider[0]
            : rawProvider;

        const id =
          Array.isArray(
            rawId
          )
            ? rawId[0]
            : rawId;

        if (
          !provider ||
          !id
        ) {
          return res
            .status(400)
            .json({
              message:
                "provider and id are required",
            });
        }

        const competitionName =
          queryString(
            req.query
              .competitionName
          );

        const country =
          queryString(
            req.query
              .country
          );

        const homeName =
          queryString(
            req.query
              .homeName
          );

        const awayName =
          queryString(
            req.query
              .awayName
          );

		  const competitionId =
  queryString(
    req.query
      .competitionId
  );

        const metadata =
          competitionName &&
          homeName &&
          awayName
            ? {
				competitionId,

                competitionName,

                country,

                homeName,

                awayName,
              }
            : undefined;

        const context =
          await this
            .getMatchContext
            .execute(
              provider,
              id,
              metadata
            );

        return res.json({
          context,
        });
      } catch (error) {
        console.error(
          "[MatchContextController]",
          error
        );

        return res
          .status(502)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not retrieve match context",
          });
      }
    };
}
