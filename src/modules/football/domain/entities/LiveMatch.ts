export type FootballProviderId =
  | "api-football"
  | "flashscore"
  | "sofascore"
  | "fotmob"
  | "bookmaker"
  | "manual";

export interface MatchSource {
  provider: FootballProviderId;
  externalId: string;
}

export interface MatchDataAvailability {
  score: boolean;
  events: boolean;
  redCards: boolean;
  statistics: boolean;
  possession: boolean;
  shots: boolean;
  corners: boolean;
  lineups: boolean;
  odds: boolean;
}

export interface LiveTeam {
  id: string | null;
  name: string;
  logo: string | null;
  goals: number | null;
  winner: boolean | null;
}

export interface LiveCompetition {
  id: string | null;
  name: string;
  country: string;
  logo: string | null;
  flag: string | null;
  season: string | null;
  round: string | null;
}

export interface LiveMatch {
  sources: MatchSource[];

  kickoffAt: string;

  status: {
    long: string;
    short: string;
    minute: number | null;
  };

  competition: LiveCompetition;

  home: LiveTeam;
  away: LiveTeam;

  dataAvailability: MatchDataAvailability;
}
