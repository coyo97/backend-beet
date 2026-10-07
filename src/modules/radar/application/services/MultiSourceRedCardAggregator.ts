import type {
  FootballProviderId,
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MultiSourceRedCardDetection,
  NormalizedRedCardEvent,
  RedCardConfidence,
} from "../../domain/entities/MultiSourceRedCardDetection";

import {
  SofascoreRedCardScanner,
} from "../../infrastructure/sofascore/SofascoreRedCardScanner";

import {
  OneXBetRedCardScanner,
} from "../../infrastructure/onexbet/OneXBetRedCardScanner";

import {
  FotMobRedCardScanner,
} from "../../infrastructure/fotmob/FotMobRedCardScanner";

interface PartialDetection {
  match:
    LiveMatch;

  homeRedCards:
    number;

  awayRedCards:
    number;

  provider:
    FootballProviderId;

  confidence:
    RedCardConfidence;

  events:
    NormalizedRedCardEvent[];
}

export class MultiSourceRedCardAggregator {
	  private readonly inflight =
    new Map<
      string,
      Promise<
        MultiSourceRedCardDetection[]
      >
    >();

  private readonly resultCache =
    new Map<
      string,
      {
        value:
          MultiSourceRedCardDetection[];

        expiresAt:
          number;
      }
    >();

  private readonly sharedCacheMs =
    3_000;
  
  constructor(
    private readonly oneXBetScanner:
      OneXBetRedCardScanner,

    private readonly fotMobScanner:
      FotMobRedCardScanner,

	  private readonly sofascoreScanner?:
    SofascoreRedCardScanner,
  ) {}
  public async scan(
    matches:
      LiveMatch[]
  ): Promise<
    MultiSourceRedCardDetection[]
  > {

    const key =
      this.createScanKey(
        matches
      );

    const now =
      Date.now();

    const cached =
      this.resultCache.get(
        key
      );

    if (
      cached &&
      cached.expiresAt >
        now
    ) {
      console.log(
        "[RedCards SHARED]",
        "cache-hit",
        `matches=${matches.length}`
      );

      return cached.value;
    }

    const running =
      this.inflight.get(
        key
      );

    if (
      running
    ) {
      console.log(
        "[RedCards SHARED]",
        "inflight-hit",
        `matches=${matches.length}`
      );

      return running;
    }

    const promise =
      this.scanInternal(
        matches
      );

    this.inflight.set(
      key,
      promise
    );

    try {
      const value =
        await promise;

      this.resultCache.set(
        key,
        {
          value,

          expiresAt:
            Date.now() +
            this.sharedCacheMs,
        }
      );

      return value;
    } finally {
      this.inflight.delete(
        key
      );

      this.cleanupCache();
    }
  }
  
    private createScanKey(
    matches:
      LiveMatch[]
  ): string {

    return matches
      .map(
        match =>
          match.sources
            .map(
              source =>
                `${source.provider}:${source.externalId}`
            )
            .sort()
            .join(
              "|"
            )
      )
      .sort()
      .join(
        "||"
      );
  }

  private cleanupCache():
    void {

    const now =
      Date.now();

    for (
      const [
        key,
        entry,
      ]
      of this.resultCache
    ) {
      if (
        entry.expiresAt <=
        now
      ) {
        this.resultCache.delete(
          key
        );
      }
    }
  }

private async scanInternal(
  matches:
    LiveMatch[]
): Promise<
  MultiSourceRedCardDetection[]
> {

    /*
     * Importante:
     *
     * Cada scanner puede fallar sin
     * tumbar al otro.
     */
const sofascoreScanner =
  this.sofascoreScanner;

/*
 * ========================================
 * FASE 1
 * ========================================
 *
 * 1xBet y SofaScore son baratos:
 *
 * - 1xBet usa una sola descarga HTML.
 * - SofaScore usa un solo snapshot live
 *   y solo pide incidents para las rojas.
 *
 * Los ejecutamos en paralelo.
 */
const [
  oneXBetResult,
  sofascoreResult,
] =
  await Promise.allSettled([
    this.measure(
      "1xbet",
      () =>
        this.oneXBetScanner
          .scan(
            matches
          )
    ),

    sofascoreScanner
      ? this.measure(
          "sofascore",
          () =>
            sofascoreScanner
              .scan(
                matches
              )
        )
      : Promise.resolve(
          []
        ),
  ]);

/*
 * ========================================
 * FASE 2
 * FOTMOB COMO FALLBACK
 * ========================================
 *
 * Si SofaScore funcionó:
 * FotMob solo revisa partidos
 * que NO tengan fuente SofaScore.
 *
 * Si SofaScore falla:
 * FotMob recibe todos los partidos.
 */
const sofascoreHealthy =
  !sofascoreScanner ||
  sofascoreResult.status ===
    "fulfilled";

/*
 * ========================================
 * FOTMOB INDEPENDIENTE
 * ========================================
 *
 * FotMob NO depende de que SofaScore
 * funcione o no.
 *
 * Si un partido tiene fuente FotMob,
 * FotMob puede detectar una roja aunque:
 *
 * - Sofa esté bloqueado;
 * - Sofa esté incompleto;
 * - Sofa devuelva [] sin lanzar error.
 *
 * El propio FotMobRedCardScanner ya
 * filtra los partidos que realmente
 * tienen source=fotmob.
 */
const fotMobMatches =
  matches;

console.log(
  "[RedCards PERF]",
  `fotmob-input=${fotMobMatches.length}`,
  `mode=independent-full`
);

const [
  fotMobResult,
] =
  await Promise.allSettled([
    this.measure(
      "fotmob",
      () =>
        this.fotMobScanner
          .scan(
            fotMobMatches
          )
    ),
  ]);
    const partials:
      PartialDetection[] =
        [];

    if (
      oneXBetResult.status ===
      "fulfilled"
    ) {

      for (
        const item
        of oneXBetResult.value
      ) {

        const homeRedCards =
          item.snapshot
            .homeRedCards ??
          0;

        const awayRedCards =
          item.snapshot
            .awayRedCards ??
          0;

        if (
          homeRedCards +
            awayRedCards ===
          0
        ) {
          continue;
        }

        partials.push({
          match:
            item.match,

          homeRedCards,

          awayRedCards,

          provider:
            "bookmaker",

          /*
           * Solo llegamos aquí si el
           * extractor encontró campos
           * explícitos de roja.
           */
          confidence:
            "high",

          events:
            [],
        });
      }
    }

    if (
      fotMobResult.status ===
      "fulfilled"
    ) {

      for (
        const item
        of fotMobResult.value
      ) {

        partials.push({
          match:
            item.match,

          homeRedCards:
            item.snapshot
              .homeRedCards ??
            0,

          awayRedCards:
            item.snapshot
              .awayRedCards ??
            0,

          provider:
            "fotmob",

          confidence:
            item.snapshot
              .confidence ===
            "high"
              ? "high"
              : item.snapshot
                    .confidence ===
                  "medium"
                ? "medium"
                : "low",

          events:
            item.snapshot
              .events
              .map(
                (
                  event
                ) => ({
                  provider:
                    "fotmob",

                  externalEventId:
                    event.eventId,

                  side:
                    event.side,

                  minute:
                    event.minute,

                  addedTime:
                    event.addedTime,

                  playerId:
                    event.playerId,

                  playerName:
                    event.playerName,

                  type:
                    event.type,
                })
              ),
        });
      }
    }

	if (
  sofascoreResult.status ===
  "fulfilled"
) {

  for (
    const item
    of sofascoreResult.value
  ) {

    partials.push({
      match:
        item.match,

      homeRedCards:
        item.homeRedCards,

      awayRedCards:
        item.awayRedCards,

      provider:
        "sofascore",

      /*
       * /incidents nos devuelve
       * un evento explícito de tarjeta
       * roja, por eso la detección
       * es de alta confianza.
       */
      confidence:
        "high",

      events:
        item.events.map(
          event => ({
            provider:
              "sofascore",

            externalEventId:
              event.eventId,

            side:
              event.side,

            minute:
              event.minute,

            addedTime:
              event.addedTime,

            playerId:
              event.playerId,

            playerName:
              event.playerName,

            type:
              event.type,
          })
        ),
    });
  }
}

    return this.merge(
      partials
    );
  }

  private async measure<T>(
  name:
    string,

  action:
    () => Promise<T>
): Promise<T> {

  const startedAt =
    Date.now();

  try {
    return await action();
  } finally {
    console.log(
      "[RedCards PERF]",
      name,
      `${Date.now() - startedAt}ms`
    );
  }
}

  private merge(
    detections:
      PartialDetection[]
  ): MultiSourceRedCardDetection[] {

    const result =
      new Map<
        string,
        MultiSourceRedCardDetection
      >();

    for (
      const detection
      of detections
    ) {

      const key =
        this.matchKey(
          detection.match
        );

      const existing =
        result.get(
          key
        );

      if (!existing) {

        result.set(
          key,
          {
            match:
              detection.match,

            homeRedCards:
              detection
                .homeRedCards,

            awayRedCards:
              detection
                .awayRedCards,

            totalRedCards:
              detection
                .homeRedCards +
              detection
                .awayRedCards,

            sources: [
              detection.provider,
            ],

            confidence:
              detection
                .confidence,

            events:
              detection.events,
          }
        );

        continue;
      }

      /*
       * Nunca sumamos conteos entre
       * providers.
       *
       * Si ambos dicen "1 roja" sigue
       * siendo 1, no 2.
       */
      existing.homeRedCards =
        Math.max(
          existing
            .homeRedCards,

          detection
            .homeRedCards
        );

      existing.awayRedCards =
        Math.max(
          existing
            .awayRedCards,

          detection
            .awayRedCards
        );

      existing.totalRedCards =
        existing
          .homeRedCards +
        existing
          .awayRedCards;

      if (
        !existing.sources
          .includes(
            detection.provider
          )
      ) {
        existing.sources.push(
          detection.provider
        );
      }

      existing.events =
        this.mergeEvents(
          existing.events,
          detection.events
        );

      existing.confidence =
        this.resolveConfidence(
          existing
        );
    }

    return Array.from(
      result.values()
    );
  }

  private resolveConfidence(
    detection:
      MultiSourceRedCardDetection
  ): RedCardConfidence {

    /*
     * Dos fuentes independientes
     * confirmando una expulsión.
     */
    if (
      detection.sources.length >=
      2
    ) {
      return "high";
    }

    return detection
      .confidence;
  }

  private mergeEvents(
    current:
      NormalizedRedCardEvent[],

    incoming:
      NormalizedRedCardEvent[]
  ): NormalizedRedCardEvent[] {

    const result =
      [
        ...current,
      ];

    const keys =
      new Set(
        current.map(
          (
            event
          ) =>
            this.eventKey(
              event
            )
        )
      );

    for (
      const event
      of incoming
    ) {

      const key =
        this.eventKey(
          event
        );

      if (
        keys.has(
          key
        )
      ) {
        continue;
      }

      keys.add(
        key
      );

      result.push(
        event
      );
    }

    return result;
  }

  private eventKey(
    event:
      NormalizedRedCardEvent
  ): string {

    return [
      event.provider,

      event.externalEventId ??
        "",

      event.side ??
        "",

      event.minute ??
        "",

      event.playerId ??
        "",

      event.playerName ??
        "",

      event.type,
    ].join(
      ":"
    );
  }

  private matchKey(
    match:
      LiveMatch
  ): string {

    /*
     * Si el LiveMatch ya fue deduplicado
     * por Composite, estas fuentes nos
     * dan la identidad más fiable.
     */
    const sourceKey =
      match.sources
        .map(
          (
            source
          ) =>
            `${source.provider}:${source.externalId}`
        )
        .sort()
        .join(
          "|"
        );

    if (sourceKey) {
      return sourceKey;
    }

    return [
      this.normalize(
        match.competition
          .name
      ),

      this.normalize(
        match.home.name
      ),

      this.normalize(
        match.away.name
      ),

      match.kickoffAt
        .slice(
          0,
          16
        ),
    ].join(
      ":"
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
