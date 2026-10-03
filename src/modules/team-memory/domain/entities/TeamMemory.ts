export type TeamMemoryOutcome =
  | "win"
  | "loss";

export interface TeamMemoryEvent {
  id:
    string;

  teamName:
    string;

  teamKey:
    string;

  outcome:
    TeamMemoryOutcome;

  opponentName:
    string | null;

  competitionName:
    string | null;

  kickoffAt:
    string | null;

  provider:
    string | null;

  externalId:
    string | null;

  note:
    string | null;

  createdAt:
    string;
}

export interface CreateTeamMemoryEventInput {
  teamName:
    string;

  outcome:
    TeamMemoryOutcome;

  opponentName?:
    string | null;

  competitionName?:
    string | null;

  kickoffAt?:
    string | null;

  provider?:
    string | null;

  externalId?:
    string | null;

  note?:
    string | null;
}

export interface TeamMemorySummary {
  teamName:
    string;

  wins:
    number;

  losses:
    number;

  total:
    number;

  balance:
    number;

  lastOutcome:
    TeamMemoryOutcome |
    null;

  lastUpdatedAt:
    string | null;
}
