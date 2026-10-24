import type {
  MatchContext,
} from "../../../match-context/domain/entities/MatchContext";

import type {
  MatchOpponentAnalysis,
} from "../entities/MatchOpponentAnalysis";

import {
  CommonOpponentAnalyzer,
} from "./CommonOpponentAnalyzer";

import {
  OpponentStrengthAnalyzer,
} from "./OpponentStrengthAnalyzer";

export class MatchOpponentAnalysisService {

  constructor(
    private readonly opponentStrength:
      OpponentStrengthAnalyzer =
        new OpponentStrengthAnalyzer(),

    private readonly commonOpponents:
      CommonOpponentAnalyzer =
        new CommonOpponentAnalyzer()
  ) {}

  public analyze(
    context:
      MatchContext
  ): MatchOpponentAnalysis {

    return {
      homeDifficulty:
        this.opponentStrength
          .analyze(
            context.home
          ),

      awayDifficulty:
        this.opponentStrength
          .analyze(
            context.away
          ),

      commonOpponents:
        this.commonOpponents
          .analyze(
            context.home,
            context.away
          ),
    };
  }
}
