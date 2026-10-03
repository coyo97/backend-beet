export interface FlashscoreSummaryPlayer {
  id?: string | null;
  name?: string | null;
}

export interface FlashscoreIncident {
  id?: string | null;

  team?:
    | "home"
    | "away"
    | null;

  minute?: string | null;

  minute_number?:
    | number
    | null;

  type?: string | null;

  reason?: string | null;

  description?:
    | string
    | null;

  player?:
    | FlashscoreSummaryPlayer
    | null;

  home_score?:
    | number
    | null;

  away_score?:
    | number
    | null;
}

export interface FlashscoreSummaryPeriod {
  period?: string | null;

  home_score_at_start?:
    | number
    | null;

  away_score_at_start?:
    | number
    | null;

  incidents:
    FlashscoreIncident[];
}

export interface FlashscoreSummaryResponse {
  id: string;

  status?: string;

  stage?: string;

  period_count?: number;

  incident_count?: number;

  periods:
    FlashscoreSummaryPeriod[];
}
