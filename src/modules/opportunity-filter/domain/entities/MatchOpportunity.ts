import type {
  LiveMatch,
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  RecentResult,
} from "../../../match-context/domain/entities/MatchContext";

export type MatchOpportunityProfile =
  | "clear-favorite"
  | "moderate-favorite"
  | "slight-edge"
  | "balanced"
  | "insufficient-data";

export type MatchOpportunitySignal =
  | "form-mismatch"
  | "dangerous-underdog"
  | "home-strong"
  | "away-strong"
  | "table-gap"
  | "five-win-streak";

export type OpportunitySide =
  | "home"
  | "away"
  | null;

export type TeamDangerLevel =
  | "low"
  | "medium"
  | "high";

export interface NotableRecentWin {
  opponentName:
    string;

  opponentPosition:
    number;

  reason:
    | "top-3"
    | "top-5"
    | "higher-ranked";
}

export interface TeamOpportunitySnapshot {
  name:
    string;

  strength:
    number;

  matchStrength:
    number;

  dataQuality:
    number;

  position:
    number | null;

  points:
    number | null;

  played:
    number | null;

  pointsPerGame:
    number | null;

  wins:
    number | null;

  draws:
    number | null;

  losses:
    number | null;

  winRate:
    number | null;

  goalDifferencePerGame:
    number | null;

  form:
    RecentResult[];

  formPoints:
    number;

  formMaxPoints:
    number;

  recentMatchesCount:
    number;

  dangerScore:
    number;

  dangerLevel:
    TeamDangerLevel;

  notableWins:
    NotableRecentWin[];
}

export interface MatchOpportunity {
  match:
    LiveMatch;

  contextSource:
    MatchSource;

  profile:
    MatchOpportunityProfile;

  favoredSide:
    OpportunitySide;

  hasTable:
    boolean;

  dataQuality:
    number;

  rawGap:
    number;

  adjustedGap:
    number;

  home:
    TeamOpportunitySnapshot;

  away:
    TeamOpportunitySnapshot;

  signals:
    MatchOpportunitySignal[];

  reasons:
    string[];

  warnings:
    string[];
}
