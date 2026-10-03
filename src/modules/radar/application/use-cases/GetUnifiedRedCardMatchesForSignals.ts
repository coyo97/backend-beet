import type {
  GetLiveMatches,
} from "../../../football/application/use-cases/GetLiveMatches";

import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  RedCardRadarMatch,
} from "../../domain/entities/RedCardRadarMatch";

import type {
  GetRedCardMatches,
  RedCardRadarFilters,
} from "./GetRedCardMatches";

import type {
  MultiSourceRedCardAggregator,
} from "../services/MultiSourceRedCardAggregator";

export class GetUnifiedRedCardMatchesForSignals {
  constructor(
    private readonly legacy:
      GetRedCardMatches,

    private readonly getLiveMatches:
      GetLiveMatches,

    private readonly supplementalAggregator:
      MultiSourceRedCardAggregator
  ) {}

  public async execute(
    filters:
      RedCardRadarFilters = {}
  ): Promise<
    RedCardRadarMatch[]
  > {

    /*
     * Legacy y live son independientes.
     *
     * Si uno falla, no perdemos
     * necesariamente el otro.
     */
    const [
      legacyResult,
      liveResult,
    ] =
      await Promise.allSettled([
        this.legacy
          .execute(
            filters
          ),

        this.getLiveMatches
          .execute({
            country:
              filters.country,
          }),
      ]);

    const result:
      RedCardRadarMatch[] =
        legacyResult.status ===
          "fulfilled"
          ? [
              ...legacyResult.value,
            ]
          : [];

    if (
      liveResult.status !==
      "fulfilled"
    ) {
      return result;
    }

    let detections;

    try {
      detections =
        await this
          .supplementalAggregator
          .scan(
            liveResult.value
          );
    } catch (
      error
    ) {

      console.warn(
        "[GetUnifiedRedCardMatchesForSignals] supplemental scan failed",
        error
      );

      return result;
    }

    for (
      const detection
      of detections
    ) {

      const supplemental:
        RedCardRadarMatch =
        {
          match: {
            ...detection.match,

            dataAvailability: {
              ...detection.match
                .dataAvailability,

              redCards:
                true,
            },
          },

          redCards: {
            home:
              detection
                .homeRedCards,

            away:
              detection
                .awayRedCards,

            unknown:
              0,

            /*
             * Por ahora no inventamos
             * MatchIncident desde simples
             * contadores 1xBet.
             *
             * Los eventos FotMob se podrán
             * adaptar después.
             */
            incidents:
              [],
          },
        };

      const existingIndex =
        result.findIndex(
          (
            current
          ) =>
            this.isSameMatch(
              current.match,
              supplemental.match
            )
        );

      if (
        existingIndex ===
        -1
      ) {

        result.push(
          supplemental
        );

        continue;
      }

      /*
       * Flashscore y supplemental están
       * hablando del mismo partido.
       *
       * Nunca sumamos:
       *
       * 1 + 1 != 2 si son dos fuentes
       * confirmando la misma roja.
       */
      const existing =
        result[
          existingIndex
        ];

      result[
        existingIndex
      ] = {
        ...existing,

        match: {
          ...existing.match,

          sources:
            this.mergeSources(
              existing.match
                .sources,

              supplemental.match
                .sources
            ),

          dataAvailability: {
            ...existing.match
              .dataAvailability,

            redCards:
              true,
          },
        },

        redCards: {
          home:
            Math.max(
              existing
                .redCards
                .home,

              supplemental
                .redCards
                .home
            ),

          away:
            Math.max(
              existing
                .redCards
                .away,

              supplemental
                .redCards
                .away
            ),

          unknown:
            existing
              .redCards
              .unknown,

          incidents:
            existing
              .redCards
              .incidents,
        },
      };
    }

    return result;
  }

  private isSameMatch(
    left:
      LiveMatch,

    right:
      LiveMatch
  ): boolean {

    /*
     * Evidencia más fiable:
     * mismo provider + mismo ID.
     */
    for (
      const leftSource
      of left.sources
    ) {

      const matched =
        right.sources.some(
          (
            rightSource
          ) =>
            leftSource.provider ===
              rightSource.provider &&
            leftSource.externalId ===
              rightSource.externalId
        );

      if (matched) {
        return true;
      }
    }

    /*
     * Fallback para providers diferentes.
     */
    const sameHome =
      this.normalize(
        left.home.name
      ) ===
      this.normalize(
        right.home.name
      );

    const sameAway =
      this.normalize(
        left.away.name
      ) ===
      this.normalize(
        right.away.name
      );

    if (
      !sameHome ||
      !sameAway
    ) {
      return false;
    }

    const sameCompetition =
      this.normalize(
        left.competition.name
      ) ===
      this.normalize(
        right.competition.name
      );

    if (
      !sameCompetition
    ) {
      return false;
    }

    const leftKickoff =
      new Date(
        left.kickoffAt
      ).getTime();

    const rightKickoff =
      new Date(
        right.kickoffAt
      ).getTime();

    if (
      !Number.isFinite(
        leftKickoff
      ) ||
      !Number.isFinite(
        rightKickoff
      )
    ) {
      return true;
    }

    return (
      Math.abs(
        leftKickoff -
        rightKickoff
      ) <=
      30 *
        60_000
    );
  }

  private mergeSources(
    left:
      LiveMatch[
        "sources"
      ],

    right:
      LiveMatch[
        "sources"
      ]
  ): LiveMatch[
    "sources"
  ] {

    const result =
      new Map<
        string,
        LiveMatch[
          "sources"
        ][number]
      >();

    for (
      const source
      of [
        ...left,
        ...right,
      ]
    ) {

      result.set(
        `${source.provider}:${source.externalId}`,
        source
      );
    }

    return Array.from(
      result.values()
    );
  }

  private normalize(
    value:
      string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /\b(fc|cf|sc|afc|club)\b/g,
        " "
      )
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }
}
