import type {
  MatchOpportunity,
  MatchOpportunityProfile,
} from "../../domain/entities/MatchOpportunity";

export type BettorFilterMode =
  | "all"
  | "clear-favorite"
  | "moderate-favorite"
  | "balanced"
  | "form-mismatch"
  | "danger-watch"
  | "home-strong"
  | "away-strong";

export interface BettorFilterConfig {
  mode:
    BettorFilterMode;

  minDataQuality?:
    number;

  minAdjustedGap?:
    number;

  requireTable?:
    boolean;

  minRecentMatches?:
    number;

  limit?:
    number;
}

export class BettorFilter {

  public apply(
    opportunities:
      MatchOpportunity[],

    config:
      BettorFilterConfig
  ): MatchOpportunity[] {

    const minQuality =
      Math.min(
        Math.max(
          config.minDataQuality ??
  30,
          0
        ),
        100
      );

    const minRecentMatches =
      Math.max(
        config.minRecentMatches ??
          0,
        0
      );

    const filtered =
      opportunities.filter(
        opportunity => {

          if (
            opportunity.dataQuality <
            minQuality
          ) {
            return false;
          }

          if (
            config.requireTable &&
            !opportunity.hasTable
          ) {
            return false;
          }

          if (
            config.minAdjustedGap !==
              undefined &&
            opportunity.adjustedGap <
              config.minAdjustedGap
          ) {
            return false;
          }

          if (
            minRecentMatches >
              0 &&
            (
              opportunity.home
                .form.length <
                minRecentMatches ||
              opportunity.away
                .form.length <
                minRecentMatches
            )
          ) {
            return false;
          }

          return this.matchesMode(
            opportunity,
            config.mode
          );
        }
      );

    this.sort(
      filtered,
      config.mode
    );

    const limit =
      Math.min(
        Math.max(
          config.limit ??
            50,
          1
        ),
        200
      );

    return filtered.slice(
      0,
      limit
    );
  }

  private matchesMode(
    opportunity:
      MatchOpportunity,

    mode:
      BettorFilterMode
  ): boolean {

    switch (
      mode
    ) {

      case "clear-favorite":
        return (
          opportunity.profile ===
          "clear-favorite"
        );

      case "moderate-favorite":
        return (
          opportunity.profile ===
            "moderate-favorite" ||
          opportunity.profile ===
            "clear-favorite"
        );

      case "balanced":
        return (
          opportunity.profile ===
          "balanced"
        );

      case "form-mismatch":
        return opportunity
          .signals
          .includes(
            "form-mismatch"
          );

      case "danger-watch":
        return opportunity
          .signals
          .includes(
            "dangerous-underdog"
          );

      case "home-strong":
        return (
          opportunity
            .favoredSide ===
            "home" &&
          (
            opportunity.profile ===
              "clear-favorite" ||
            opportunity.profile ===
              "moderate-favorite"
          )
        );

      case "away-strong":
        return (
          opportunity
            .favoredSide ===
            "away" &&
          (
            opportunity.profile ===
              "clear-favorite" ||
            opportunity.profile ===
              "moderate-favorite"
          )
        );

      case "all":
      default:
        return (
          opportunity.profile !==
          "insufficient-data"
        );
    }
  }

  private sort(
    opportunities:
      MatchOpportunity[],

    mode:
      BettorFilterMode
  ): void {

    opportunities.sort(
      (
        a,
        b
      ) => {

        if (
          mode ===
          "balanced"
        ) {
          return (
            a.adjustedGap -
            b.adjustedGap
          );
        }

        if (
          mode ===
          "danger-watch"
        ) {

          const dangerA =
            Math.max(
              a.home
                .dangerScore,
              a.away
                .dangerScore
            );

          const dangerB =
            Math.max(
              b.home
                .dangerScore,
              b.away
                .dangerScore
            );

          return (
            dangerB -
              dangerA ||
            b.dataQuality -
              a.dataQuality
          );
        }

        return (
          b.adjustedGap -
            a.adjustedGap ||
          b.dataQuality -
            a.dataQuality
        );
      }
    );
  }
}
