export interface FlashscoreCountry {
  id?: number | string;
  name?: string;
}

export interface FlashscoreCompetition {
  name: string;
  link?: string;

  country?: FlashscoreCountry;
}

export interface FlashscoreTeam {
  id?: string;
  name: string;
  short_name?: string;
  link?: string;
  logo?: string;

  country?: FlashscoreCountry;
}

export interface FlashscoreMatch {
  id: string;
  link?: string;

  status: string;

  stage?: string | null;

  start_time: string;
  date?: string;

  home_score: number | null;
  away_score: number | null;

  winner?:
    | "home"
    | "away"
    | "draw"
    | null;

  competition?: FlashscoreCompetition;

  round?: string | null;

  home: FlashscoreTeam;
  away: FlashscoreTeam;

  available_tabs?: string[];

  has_statistics?: boolean;
  has_player_statistics?: boolean;
}

export interface FlashscoreCompetitionGroup {
  competition:
    FlashscoreCompetition;

  matches:
    FlashscoreMatch[];
}

export interface FlashscoreMatchesResponse {
  sport?: {
    id?: number;
    name?: string;
    slug?: string;
  };

  format?: string;

  match_count?: number;

  competition_count?: number;

  competitions?:
    FlashscoreCompetitionGroup[];

  matches?:
    FlashscoreMatch[];
}
