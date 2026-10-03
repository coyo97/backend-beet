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
  public async getLiveMatches():
    Promise<LiveMatch[]> {

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
      throw new Error(
        `API-Football error: ${JSON.stringify(
          data.errors
        )}`
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
}
