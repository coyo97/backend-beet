import type {
  RecentResult,
} from "../../../match-context/domain/entities/MatchContext";

export interface OpponentDifficultySummary {
  sampleSize:
    number;

  rankedSampleSize:
    number;

  unrankedCount:
    number;

  averagePosition:
    number |
    null;

  medianPosition:
    number |
    null;

  top3Count:
    number;

  top5Count:
    number;

  top10Count:
    number;
}

export interface TeamVsCommonOpponentSummary {
  matches:
    number;

  wins:
    number;

  draws:
    number;

  losses:
    number;

  points:
    number;

  goalsFor:
    number;

  goalsAgainst:
    number;

  goalDifference:
    number;

  venues:
    Array<
      "home" |
      "away"
    >;

  results:
    RecentResult[];
}

export interface CommonOpponentComparison {
  opponentName:
    string;

  opponentPosition:
    number |
    null;

  sameVenueContext:
    boolean;

  homeTeam:
    TeamVsCommonOpponentSummary;

  awayTeam:
    TeamVsCommonOpponentSummary;
}

export interface CommonOpponentSummary {
  count:
    number;

  sameVenueContextCount:
    number;

  homePoints:
    number;

  awayPoints:
    number;

  homeGoalsFor:
    number;

  homeGoalsAgainst:
    number;

  awayGoalsFor:
    number;

  awayGoalsAgainst:
    number;

  comparisons:
    CommonOpponentComparison[];
}

export interface MatchOpponentAnalysis {
  homeDifficulty:
    OpponentDifficultySummary;

  awayDifficulty:
    OpponentDifficultySummary;

  commonOpponents:
    CommonOpponentSummary;
}
