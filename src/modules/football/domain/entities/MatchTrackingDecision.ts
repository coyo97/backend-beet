export type MatchTrackingReason =
  | "user-pick"
  | "watchlist"
  | "red-card"
  | "opportunity"
  | "detail-opened"
  | "manual";

export type MatchTrackingOpportunityLevel =
  | "clear"
  | "moderate"
  | "other"
  | null;

export interface MatchTrackingSignals {
  userPick:
    boolean;

  watchlisted:
    boolean;

  redCard:
    boolean;

  detailOpened:
    boolean;

  manual:
    boolean;

  opportunityLevel:
    MatchTrackingOpportunityLevel;
}

export interface MatchTrackingDecision {
  track:
    boolean;

  reasons:
    MatchTrackingReason[];

  refreshAfterMs:
    number |
    null;
}
