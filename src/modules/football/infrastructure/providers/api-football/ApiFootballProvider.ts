import {
  env,
} from "../../../../../config/env";

import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../../domain/providers/FootballProvider";

import {
  ApiFootballLiveMatchMapper,
} from "../../mappers/ApiFootballLiveMatchMapper";

import type {
  ApiFootballFixture,
  ApiFootballResponse,
} from "./ApiFootballTypes";

export class ApiFootballProvider
  implements FootballProvider
{

	  private quotaBlockedUntil =
    0;

  private readonly quotaCooldownMs =
    this.resolveQuotaCooldownMs();

  public async getLiveMatches():
    Promise<LiveMatch[]> {

	      const now =
      Date.now();

    if (
      now <
      this.quotaBlockedUntil
    ) {
      const remainingSeconds =
        Math.ceil(
          (
            this.quotaBlockedUntil -
            now
          ) /
          1000
        );

      throw new Error(
        `API-Football quota cooldown active: ${remainingSeconds}s remaining`
      );
    }

    const url =
      new URL(
        "/fixtures",
        env.API_FOOTBALL_BASE_URL
      );

    url.searchParams.set(
      "live",
      "all"
    );

    const response =
      await fetch(
        url,
        {
          headers: {
            "x-apisports-key":
              env.API_FOOTBALL_KEY,

            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        `API-Football HTTP ${response.status}`
      );
    }

const data =
  (await response.json()) as ApiFootballResponse<
    ApiFootballFixture
  >;

        if (
      this.hasErrors(
        data.errors
      )
    ) {
      const serializedErrors =
        JSON.stringify(
          data.errors
        );

      if (
        this.isDailyQuotaError(
          serializedErrors
        )
      ) {
        this.quotaBlockedUntil =
          Date.now() +
          this.quotaCooldownMs;

        console.warn(
          "[ApiFootballProvider]",
          "daily quota exhausted;",
          `cooldown=${this.quotaCooldownMs}ms`
        );
      }

      throw new Error(
        `API-Football error: ${serializedErrors}`
      );
    }

    return data.response.map(
      ApiFootballLiveMatchMapper.toDomain
    );
  }

  private hasErrors(
    errors:
      | Record<string, unknown>
      | unknown[]
  ): boolean {

    if (
      Array.isArray(errors)
    ) {
      return errors.length > 0;
    }

    return (
      Object.keys(errors).length > 0
    );
  }
    private isDailyQuotaError(
    value:
      string
  ): boolean {

    const normalized =
      value
        .toLowerCase();

    return (
      normalized.includes(
        "request limit"
      ) &&
      normalized.includes(
        "day"
      )
    );
  }

  private resolveQuotaCooldownMs():
    number {

    const parsed =
      Number(
        process.env
          .API_FOOTBALL_QUOTA_COOLDOWN_MS ??
        60 * 60 * 1000
      );

    if (
      !Number.isFinite(
        parsed
      ) ||
      parsed <
        60_000
    ) {
      return (
        60 *
        60 *
        1000
      );
    }

    return parsed;
  }
}
