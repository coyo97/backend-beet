export interface FlashscoreTeamRef {
  id:
    string | null;

  name:
    string;

  short_name?:
    string | null;

  link?:
    string | null;

  logo?:
    string | null;
}

export interface FlashscoreMatchDetails {
  id:
    string;

  competition: {
    name:
      string;

    link?:
      string | null;

    country?: {
      id?:
        number | null;

      name?:
        string | null;
    } | null;
  };

  round?:
    string | null;

  home:
    FlashscoreTeamRef;

  away:
    FlashscoreTeamRef;
}

export interface FlashscoreRecentMatch {
  id?:
    string | null;

  result?:
    "win" |
    "draw" |
    "loss" |
    null;

  start_time?:
    string | null;

  date?:
    string | null;

  home:
    FlashscoreTeamRef;

  away:
    FlashscoreTeamRef;

  home_score:
    number | null;

  away_score:
    number | null;
}

export interface FlashscoreStandingRow {
  rank:
    number;

  team:
    FlashscoreTeamRef;

  matches_played:
    number | null;

  points:
    number | null;

  wins:
    number | null;

  draws:
    number | null;

  losses:
    number | null;

  goals_for:
    number | null;

  goals_against:
    number | null;

  goal_difference:
    number | null;

  points_per_match?:
    number | null;

  recent_matches?:
    FlashscoreRecentMatch[];
}

export interface FlashscoreStandingsResponse {
  title?:
    string | null;

  variant?:
    string | null;

  standings?:
    FlashscoreStandingRow[];
}

export interface FlashscoreH2HSection {
  name:
    string;

  matches:
    FlashscoreRecentMatch[];
}

export interface FlashscoreH2HResponse {
  sections?:
    FlashscoreH2HSection[];
}

export interface FlashscoreLineupSide {
  formation?:
    string | null;

  groups?: Array<{
    name:
      string;

    players?:
      unknown[];
  }>;
}

export interface FlashscoreLineupsResponse {
  home?:
    FlashscoreLineupSide;

  away?:
    FlashscoreLineupSide;
}

export class FlashscoreMatchContextClient {
  private readonly baseUrl:
    string;

  constructor(
    baseUrl =
      process.env
        .FLASHSCORE_BASE_URL ??
      "http://127.0.0.1:8100"
  ) {
    this.baseUrl =
      baseUrl.replace(
        /\/+$/,
        ""
      );
  }

  public getDetails(
    matchId:
      string
  ) {
    return this.getRequired<
      FlashscoreMatchDetails
    >(
      "/matches/details",
      matchId
    );
  }

  public getStandings(
    matchId:
      string
  ) {
    return this.getOptional<
      FlashscoreStandingsResponse
    >(
      "/matches/standings",
      matchId
    );
  }

  public getH2H(
    matchId:
      string
  ) {
    return this.getOptional<
      FlashscoreH2HResponse
    >(
      "/matches/h2h",
      matchId
    );
  }

  public getLineups(
    matchId:
      string
  ) {
    return this.getOptional<
      FlashscoreLineupsResponse
    >(
      "/matches/lineups",
      matchId
    );
  }

  private async getRequired<T>(
    path:
      string,

    matchId:
      string
  ): Promise<T> {

    const response =
      await fetch(
        this.url(
          path,
          matchId
        )
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Flashscore ${path} HTTP ${response.status}`
      );
    }

    return await response
      .json() as T;
  }

  private async getOptional<T>(
    path:
      string,

    matchId:
      string
  ): Promise<
    T | null
  > {

    try {
      const response =
        await fetch(
          this.url(
            path,
            matchId
          )
        );

      if (
        response.status ===
          404 ||
        response.status ===
          204
      ) {
        return null;
      }

      if (
        !response.ok
      ) {
        console.warn(
          "[MatchContext]",
          path,
          response.status
        );

        return null;
      }

      return await response
        .json() as T;
    } catch (error) {
      console.warn(
        "[MatchContext]",
        path,
        error
      );

      return null;
    }
  }

  private url(
    path:
      string,

    matchId:
      string
  ): string {

    return (
      `${this.baseUrl}${path}` +
      `?match=${encodeURIComponent(matchId)}`
    );
  }
}
