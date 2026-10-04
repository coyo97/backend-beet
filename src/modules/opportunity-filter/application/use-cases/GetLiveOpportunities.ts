import type {
  LiveMatch,
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  GetLiveMatches,
} from "../../../football/application/use-cases/GetLiveMatches";

import type {
  GetMatchContext,
} from "../../../match-context/application/use-cases/GetMatchContext";

import type {
  MatchOpportunity,
} from "../../domain/entities/MatchOpportunity";

import {
  MatchOpportunityScorer,
} from "../../domain/services/MatchOpportunityScorer";

import {
  BettorFilter,
  type BettorFilterConfig,
} from "../services/BettorFilter";

export interface LiveOpportunityConfig
  extends BettorFilterConfig {

  country?:
    string;

  scanLimit?:
    number;

  concurrency?:
    number;

  excludeFriendly?:
    boolean;

  excludeYouth?:
    boolean;

  excludeReserve?:
    boolean;

  excludeWomen?:
    boolean;
}

export interface LiveOpportunitiesResult {
  totalLive:
    number;

  candidates:
    number;

  analyzed:
    number;

  unavailable:
    number;

  opportunities:
    MatchOpportunity[];
}

export class GetLiveOpportunities {

  constructor(
    private readonly getLiveMatches:
      GetLiveMatches,

    private readonly getMatchContext:
      GetMatchContext,

    private readonly scorer:
      MatchOpportunityScorer =
        new MatchOpportunityScorer(),

    private readonly filter:
      BettorFilter =
        new BettorFilter()
  ) {}

  public async execute(
    config:
      LiveOpportunityConfig
  ): Promise<
    LiveOpportunitiesResult
  > {

    const matches =
      await this.getLiveMatches
        .execute({
          country:
            config.country,
        });

    const filteredMatches =
      matches.filter(
        match =>
          this.acceptBeforeAnalysis(
            match,
            config
          )
      );

    const scanLimit =
      Math.min(
        Math.max(
          config.scanLimit ??
            60,
          1
        ),
        200
      );

    const candidates =
      filteredMatches.slice(
        0,
        scanLimit
      );

    const concurrency =
      Math.min(
        Math.max(
          config.concurrency ??
            4,
          1
        ),
        6
      );

    const analyzed:
      MatchOpportunity[] =
      [];

    let unavailable =
      0;

    let cursor =
      0;

    const worker =
      async () => {

        while (
          true
        ) {

          const index =
            cursor++;

          if (
            index >=
            candidates.length
          ) {
            return;
          }

          const match =
            candidates[
              index
            ];

          const opportunity =
            await this
              .analyzeMatch(
                match
              );

          if (
            opportunity
          ) {
            analyzed.push(
              opportunity
            );
          } else {
            unavailable +=
              1;
          }
        }
      };

    await Promise.all(
      Array.from(
        {
          length:
            Math.min(
              concurrency,
              candidates.length
            ),
        },
        () =>
          worker()
      )
    );

    const opportunities =
      this.filter.apply(
        analyzed,
        {
          mode:
            config.mode,

          minDataQuality:
            config.minDataQuality,

          minAdjustedGap:
            config.minAdjustedGap,

          requireTable:
            config.requireTable,

          minRecentMatches:
            config.minRecentMatches,

          limit:
            config.limit,
        }
      );

    return {
      totalLive:
        matches.length,

      candidates:
        candidates.length,

      analyzed:
        analyzed.length,

      unavailable,

      opportunities,
    };
  }

  private async analyzeMatch(
    match:
      LiveMatch
  ): Promise<
    MatchOpportunity |
    null
  > {

    const sources =
      this.getContextSources(
        match
      );

    if (
      sources.length ===
      0
    ) {
      return null;
    }

    for (
      const source
      of sources
    ) {

      try {
        const context =
          await this
            .getMatchContext
            .execute(
              source.provider,
              source.externalId,
              {
                competitionId:
                  match
                    .competition
                    .id,

                competitionName:
                  match
                    .competition
                    .name,

                country:
                  match
                    .competition
                    .country,

                homeName:
                  match
                    .home
                    .name,

                awayName:
                  match
                    .away
                    .name,
              }
            );

        return this.scorer
          .score(
            match,
            context
          );
      } catch (
        error
      ) {

        /*
         * No rompemos el batch.
         *
         * Ejemplo:
         * Flashscore falla,
         * pero el mismo partido
         * también tiene SofaScore.
         */
        if (
          process.env
            .NODE_ENV !==
          "production"
        ) {
          console.warn(
            "[GetLiveOpportunities.context]",
            source.provider,
            source.externalId,
            error instanceof
              Error
              ? error.message
              : error
          );
        }
      }
    }

    return null;
  }

  private getContextSources(
    match:
      LiveMatch
  ): MatchSource[] {

    const priority =
      new Map<
        string,
        number
      >([
        [
          "flashscore",
          1,
        ],
        [
          "fotmob",
          2,
        ],
        [
          "sofascore",
          3,
        ],
        [
          "bookmaker",
          4,
        ],
      ]);

    return match.sources
      .filter(
        source =>
          priority.has(
            source.provider
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            priority.get(
              a.provider
            ) ??
            99
          ) -
          (
            priority.get(
              b.provider
            ) ??
            99
          )
      );
  }

  private acceptBeforeAnalysis(
    match:
      LiveMatch,

    config:
      LiveOpportunityConfig
  ): boolean {

    const text =
      [
        match
          .competition
          .name,

        match.home.name,

        match.away.name,
      ]
        .join(
          " "
        )
        .normalize(
          "NFD"
        )
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase();

    if (
      config
        .excludeFriendly &&
      /friendly|amistoso/
        .test(
          text
        )
    ) {
      return false;
    }

    if (
      config
        .excludeYouth &&
      /youth|juvenil|junior|u[- ]?(?:17|18|19|20|21|23)\b/
        .test(
          text
        )
    ) {
      return false;
    }

    if (
      config
        .excludeReserve &&
      /reserve|reserva|reservas/
        .test(
          text
        )
    ) {
      return false;
    }

    if (
      config
        .excludeWomen &&
      /women|woman|femenin|feminin|ladies/
        .test(
          text
        )
    ) {
      return false;
    }

    return true;
  }
}
