import type {
  LiveMatch,
} from "../entities/LiveMatch";

import type {
  MatchTrackingDecision,
  MatchTrackingReason,
  MatchTrackingSignals,
} from "../entities/MatchTrackingDecision";

interface Options {
  earlyMatchIntervalMs:
    number;

  middleMatchIntervalMs:
    number;

  lateMatchIntervalMs:
    number;
}

const DEFAULT_OPTIONS:
  Options = {
    /*
     * 0-59'
     */
    earlyMatchIntervalMs:
      60_000,

    /*
     * 60-74'
     */
    middleMatchIntervalMs:
      30_000,

    /*
     * 75'+
     */
    lateMatchIntervalMs:
      20_000,
  };

export class MatchTrackingPolicy {

  constructor(
    private readonly options:
      Options =
        DEFAULT_OPTIONS
  ) {}

  public evaluate(
    match:
      LiveMatch,

    signals:
      MatchTrackingSignals
  ): MatchTrackingDecision {

    const reasons:
      MatchTrackingReason[] =
      [];

    if (
      signals.userPick
    ) {
      reasons.push(
        "user-pick"
      );
    }

    if (
      signals.watchlisted
    ) {
      reasons.push(
        "watchlist"
      );
    }

    if (
      signals.redCard
    ) {
      reasons.push(
        "red-card"
      );
    }

    if (
      signals.detailOpened
    ) {
      reasons.push(
        "detail-opened"
      );
    }

    if (
      signals.manual
    ) {
      reasons.push(
        "manual"
      );
    }

    /*
     * Reutilizamos la clasificación
     * REAL del Radar de oportunidades.
     *
     * No inventamos otro score.
     */
    if (
      signals.opportunityLevel ===
        "clear" ||
      signals.opportunityLevel ===
        "moderate"
    ) {
      reasons.push(
        "opportunity"
      );
    }

    if (
      reasons.length ===
      0
    ) {
      return {
        track:
          false,

        reasons:
          [],

        refreshAfterMs:
          null,
      };
    }

    return {
      track:
        true,

      reasons,

      refreshAfterMs:
        this.resolveRefreshMs(
          match
        ),
    };
  }

  private resolveRefreshMs(
    match:
      LiveMatch
  ): number {

    const minute =
      match.status.minute ??
      0;

    if (
      minute >=
      75
    ) {
      return this.options
        .lateMatchIntervalMs;
    }

    if (
      minute >=
      60
    ) {
      return this.options
        .middleMatchIntervalMs;
    }

    return this.options
      .earlyMatchIntervalMs;
  }
}
