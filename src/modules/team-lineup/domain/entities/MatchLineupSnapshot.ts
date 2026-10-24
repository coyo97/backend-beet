export type MatchLineupStatus =
  | "confirmed"
  | "partial"
  | "unavailable";

export interface MatchLineupPlayer {
  playerId:
    string | null;

  name:
    string;

  position:
    string | null;

  isGoalkeeper:
    boolean;
}

export interface MatchLineupTeam {
  teamId:
    string | null;

  teamName:
    string;

  starters:
    MatchLineupPlayer[];

  substitutes:
    MatchLineupPlayer[];
}

export interface MatchLineupSnapshot {
  provider:
    string;

  externalId:
    string;

  sourceKey:
    string;

  kickoffAt:
    string | null;

  status:
    MatchLineupStatus;

  home:
    MatchLineupTeam;

  away:
    MatchLineupTeam;

  fetchedAt:
    string;
}
