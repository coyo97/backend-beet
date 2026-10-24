import type {
  MatchSide,
} from "./MatchIncident";

export interface GoalScorerSummary {
  playerId:
    string |
    null;

  playerName:
    string |
    null;

  goals:
    number;

  late80Goals:
    number;

  late90Goals:
    number;
}

export interface GoalEvent {
  incidentId:
    string |
    null;

  side:
    MatchSide;

  minute:
    string |
    null;

  minuteNumber:
    number |
    null;

  /*
   * Ejemplos:
   *
   * 54'    -> 54
   * 45+2'  -> 47
   * 90+4'  -> 94
   */
  effectiveMinute:
    number |
    null;

  addedTime:
    number;

  late80:
    boolean;

  late90:
    boolean;

  player: {
    id:
      string |
      null;

    name:
      string |
      null;
  } |
    null;

  reason:
    string |
    null;

  description:
    string |
    null;

  homeScore:
    number |
    null;

  awayScore:
    number |
    null;
}

export interface TeamGoalTimingSummary {
  total:
    number;

  late80:
    number;

  late90:
    number;

  scorers:
    GoalScorerSummary[];
}

export interface MatchGoalAnalysis {
  totalGoals:
    number;

  late80Goals:
    number;

  late90Goals:
    number;

  home:
    TeamGoalTimingSummary;

  away:
    TeamGoalTimingSummary;

  unknownSideGoals:
    number;

  events:
    GoalEvent[];
}
