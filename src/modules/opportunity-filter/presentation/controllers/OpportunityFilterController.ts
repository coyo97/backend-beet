import type {
  Request,
  Response,
} from "express";

import type {
  GetLiveOpportunities,
} from "../../application/use-cases/GetLiveOpportunities";

import type {
  BettorFilterMode,
} from "../../application/services/BettorFilter";

const MODES:
  BettorFilterMode[] =
[
  "all",
  "clear-favorite",
  "moderate-favorite",
  "balanced",
  "form-mismatch",
  "danger-watch",
  "home-strong",
  "away-strong",
];

function stringValue(
  value:
    unknown
): string | undefined {

  return typeof value ===
    "string"
    ? value
    : undefined;
}

function numberValue(
  value:
    unknown
): number | undefined {

  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : undefined;
}

function booleanValue(
  value:
    unknown,

  fallback =
    false
): boolean {

  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  if (
    value ===
      "true" ||
    value ===
      "1"
  ) {
    return true;
  }

  if (
    value ===
      "false" ||
    value ===
      "0"
  ) {
    return false;
  }

  return fallback;
}

export class OpportunityFilterController {

  constructor(
    private readonly getLiveOpportunities:
      GetLiveOpportunities
  ) {}

  public live =
    async (
      req:
        Request,

      res:
        Response
    ): Promise<
      Response
    > => {

      try {
        const rawMode =
          stringValue(
            req.query.mode
          ) ??
          "all";

        const mode =
          MODES.includes(
            rawMode as
              BettorFilterMode
          )
            ? rawMode as
                BettorFilterMode
            : "all";

        const result =
          await this
            .getLiveOpportunities
            .execute({
              mode,

              country:
                stringValue(
                  req.query.country
                ),

              scanLimit:
                numberValue(
                  req.query
                    .scanLimit
                ),

              concurrency:
                numberValue(
                  req.query
                    .concurrency
                ),

              limit:
                numberValue(
                  req.query.limit
                ),

              minDataQuality:
                numberValue(
                  req.query
                    .minDataQuality
                ),

              minAdjustedGap:
                numberValue(
                  req.query
                    .minAdjustedGap
                ),

              minRecentMatches:
                numberValue(
                  req.query
                    .minRecentMatches
                ),

              requireTable:
                booleanValue(
                  req.query
                    .requireTable
                ),

              excludeFriendly:
                booleanValue(
                  req.query
                    .excludeFriendly
                ),

              excludeYouth:
                booleanValue(
                  req.query
                    .excludeYouth
                ),

              excludeReserve:
                booleanValue(
                  req.query
                    .excludeReserve
                ),

              excludeWomen:
                booleanValue(
                  req.query
                    .excludeWomen
                ),
            });

        return res.json({
          mode,

          ...result,
        });
      } catch (
        error
      ) {

        console.error(
          "[OpportunityFilterController]",
          error
        );

        return res
          .status(502)
          .json({
            message:
              error instanceof
                Error
                ? error.message
                : "Could not analyze opportunities",
          });
      }
    };
}
