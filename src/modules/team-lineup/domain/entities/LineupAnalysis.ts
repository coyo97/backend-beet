import type {
  MatchLineupPlayer,
} from "./MatchLineupSnapshot";

export type StarterFrequency =
  | "habitual"
  | "rotation"
  | "occasional"
  | "unseen";

export type LineupHistoryConfidence =
  | "none"
  | "low"
  | "medium"
  | "high";

export type RotationLevel =
  | "unknown"
  | "low"
  | "medium"
  | "high";

export interface StarterHistoryStat {
  playerId:
    string | null;

  name:
    string;

  position:
    string | null;

  starts:
    number;

  matchesObserved:
    number;

  startRate:
    number;

  frequency:
    Exclude<
      StarterFrequency,
      "unseen"
    >;
}

export interface CurrentStarterAssessment
  extends MatchLineupPlayer
{
  historyStarts:
    number;

  historyMatches:
    number;

  startRate:
    number | null;

  frequency:
    StarterFrequency;
}

export interface TeamLineupAnalysis {
  teamId:
    string | null;

  teamName:
    string;

  historicalMatches:
    number;

  confidence:
    LineupHistoryConfidence;

  rotationLevel:
    RotationLevel;

  habitualPool:
    StarterHistoryStat[];

  habitualPresent:
    number;

  habitualMissing:
    StarterHistoryStat[];

  habitualCoverage:
    number | null;

  unseenCurrentStarters:
    number;

  currentStarters:
    CurrentStarterAssessment[];
}

export interface MatchLineupAnalysis {
  sourceKey:
    string;

  historicalLimit:
    number;

  home:
    TeamLineupAnalysis;

  away:
    TeamLineupAnalysis;
}
