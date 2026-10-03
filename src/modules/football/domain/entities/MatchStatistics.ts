import type {
  MatchSource,
} from "./LiveMatch";

export interface MatchStatisticValue {
  raw: string | number | null;
  numeric: number | null;
}

export interface MatchStatisticMetric {
  key: string;
  label: string;

  home: MatchStatisticValue;
  away: MatchStatisticValue;
}

export interface MatchStatistics {
  source: MatchSource;

  period:
    | "all"
    | "first-half"
    | "second-half"
    | "unknown";

  metrics:
    MatchStatisticMetric[];
}
