import type {
  MatchSource,
} from "../entities/LiveMatch";

import type {
  MatchStatistics,
} from "../entities/MatchStatistics";

export interface MatchStatisticsProvider {
  supports(
    source: MatchSource
  ): boolean;

  getStatistics(
    source: MatchSource
  ): Promise<MatchStatistics[]>;
	}
