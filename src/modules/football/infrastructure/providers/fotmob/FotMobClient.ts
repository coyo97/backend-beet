import type {
  FotMobLeagueResponse,
  FotMobMatchDetailsResponse,
  FotMobMatchesResponse,
} from "./FotMobTypes";

export class FotMobClient {
  constructor(
    private readonly baseUrl =
      "https://www.fotmob.com/api/data"
  ) {}

  public getMatchesByDate(
    date:
      string
  ): Promise<
    FotMobMatchesResponse
  > {

    return this.getJson<
      FotMobMatchesResponse
    >(
      `/matches?date=${encodeURIComponent(date)}`
    );
  }

  public getMatchDetails(
    matchId:
      string |
      number
  ): Promise<
    FotMobMatchDetailsResponse
  > {

    return this.getJson<
      FotMobMatchDetailsResponse
    >(
      `/matchDetails?matchId=${encodeURIComponent(String(matchId))}`
    );
  }

  public getLeague(
    leagueId:
      string |
      number,

    season?:
      string
  ): Promise<
    FotMobLeagueResponse
  > {

    const params =
      new URLSearchParams();

    params.set(
      "id",
      String(
        leagueId
      )
    );

    if (season) {
      params.set(
        "season",
        season
      );
    }

    return this.getJson<
      FotMobLeagueResponse
    >(
      `/leagues?${params.toString()}`
    );
  }

  public getTable(
    leagueId:
      string |
      number
  ): Promise<
    unknown[]
  > {

    return this.getJson<
      unknown[]
    >(
      `/tltable?leagueId=${encodeURIComponent(String(leagueId))}`
    );
  }

  public getTeam(
    teamId:
      string |
      number
  ): Promise<
    Record<
      string,
      unknown
    >
  > {

    return this.getJson<
      Record<
        string,
        unknown
      >
    >(
      `/teams?id=${encodeURIComponent(String(teamId))}`
    );
  }

  private async getJson<T>(
    path:
      string
  ): Promise<T> {

    const response =
      await fetch(
        `${this.baseUrl}${path}`,
        {
          headers: {
            accept:
              "application/json,text/plain,*/*",

            "user-agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/146 Safari/537.36",

            "accept-language":
              "en-US,en;q=0.9",
          },

          signal:
            AbortSignal.timeout(
              15_000
            ),
        }
      );

    if (!response.ok) {
      throw new Error(
        `FotMob HTTP ${response.status}: ${path}`
      );
    }

    return await response
      .json() as T;
  }
}
