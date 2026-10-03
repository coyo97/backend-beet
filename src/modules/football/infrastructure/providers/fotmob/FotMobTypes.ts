export interface FotMobMatchStatus {
  utcTime?:
    string;

  started?:
    boolean;

  cancelled?:
    boolean;

  finished?:
    boolean;

  scoreStr?:
    string;

  reason?:
    string |
    {
      short?:
        string;

      long?:
        string;
    };
}

export interface FotMobTeam {
  id?:
    number;

  name?:
    string;

  longName?:
    string;

  score?:
    number;
}

export interface FotMobMatch {
  id:
    number;

  leagueId?:
    number;

  time?:
    string;

  home:
    FotMobTeam;

  away:
    FotMobTeam;

  status:
    FotMobMatchStatus;
}

export interface FotMobLeagueMatches {
  id?:
    number;

  primaryId?:
    number;

  name:
    string;

  ccode?:
    string;

  matches:
    FotMobMatch[];
}

export interface FotMobMatchesResponse {
  date:
    string;

  leagues:
    FotMobLeagueMatches[];
}

export interface FotMobMatchDetailsResponse {
  general?:
    Record<
      string,
      unknown
    >;

  header?:
    Record<
      string,
      unknown
    >;

  content?:
    Record<
      string,
      unknown
    >;

  nav?:
    Record<
      string,
      unknown
    >;

  ongoing?:
    boolean;

  hasPendingVAR?:
    boolean;
}

export type FotMobLeagueResponse =
  Record<
    string,
    unknown
  >;
