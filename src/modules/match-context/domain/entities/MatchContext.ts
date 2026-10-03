import type {
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

export type CompetitionFormat =
  | "table"
  | "cup"
  | "playoff"
  | "qualifier"
  | "friendly"
  | "unknown";

export type RecentResult =
  | "W"
  | "D"
  | "L";

export interface RecentTeamMatch {
  id:
    string | null;

  result:
    RecentResult;

  opponentName:
    string;

  opponentPosition:
    number | null;

  homeAway:
    "home" | "away";

  goalsFor:
    number;

  goalsAgainst:
    number;

  playedAt:
    string | null;
}

export interface TeamMatchContext {
  id:
    string | null;

  name:
    string;

  position:
    number | null;

  points:
    number | null;

  played:
    number | null;

  wins:
    number | null;

  draws:
    number | null;

  losses:
    number | null;

  goalsFor:
    number | null;

  goalsAgainst:
    number | null;

  goalDifference:
    number | null;

  goalsPerMatch:
    number | null;

  concededPerMatch:
    number | null;

  form:
    RecentResult[];

  recentMatches:
    RecentTeamMatch[];
}

export interface MatchLineupContext {
  status:
    | "confirmed"
    | "partial"
    | "unavailable";

  homeFormation:
    string | null;

  awayFormation:
    string | null;

  homeStarters:
    number | null;

  awayStarters:
    number | null;
}

export interface MatchCompetitionContext {
  name:
    string;

  country:
    string;

  format:
    CompetitionFormat;

  tableAvailable:
    boolean;

  /*
   * Importante:
   * por ahora esta tabla corresponde
   * a la competición del partido.
   *
   * Todavía NO afirmamos que sea
   * la tabla anual doméstica.
   */
  tableScope:
    "competition" | "none";

  annualDomesticTableAvailable:
    boolean;

  note:
    string | null;
}

export interface MatchContextAvailability {
  details:
    boolean;

  standings:
    boolean;

  recentForm:
    boolean;

  lineups:
    boolean;
}

export interface MatchContext {
  source:
    MatchSource;

  competition:
    MatchCompetitionContext;

  home:
    TeamMatchContext;

  away:
    TeamMatchContext;

  lineups:
    MatchLineupContext;

  availability:
    MatchContextAvailability;

  fetchedAt:
    string;
}
