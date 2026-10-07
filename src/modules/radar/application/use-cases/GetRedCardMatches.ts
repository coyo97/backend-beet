import type {
  GetLiveMatches,
} from "../../../football/application/use-cases/GetLiveMatches";

import type {
  MatchIncidentProvider,
} from "../../../football/domain/providers/MatchIncidentProvider";

import type {
  LiveMatch,
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  RedCardRadarMatch,
} from "../../domain/entities/RedCardRadarMatch";

import {
  RedCardDetector,
} from "../../domain/services/RedCardDetector";

export interface RedCardRadarFilters {
  country?:
    string;
}

type CachedRedCards =
  RedCardRadarMatch[
    "redCards"
  ];

interface IncidentCacheEntry {
  redCards:
    CachedRedCards |
    null;

  expiresAt:
    number;
}

export class GetRedCardMatches {

  /*
   * Resultado Flashscore compartido
   * por todo el proceso backend.
   *
   * null significa:
   * "se comprobó correctamente
   * y no había roja".
   */
  private readonly cache =
    new Map<
      string,
      IncidentCacheEntry
    >();

  /*
   * Evita dos /summary simultáneos
   * para el mismo partido.
   */
  private readonly inflight =
    new Map<
      string,
      Promise<
        RedCardRadarMatch |
        null
      >
    >();

  /*
   * Cursor global.
   *
   * No revisamos siempre los primeros
   * partidos de la lista.
   */
  private scanCursor =
    0;

  /*
   * Protección global Flashscore.
   *
   * Como GetRedCardMatches es compartido
   * por el backend, tres usuarios NO
   * multiplican esta velocidad.
   */
  private lastDeepPassAt =
    0;

  private readonly deepPassIntervalMs =
    10_000;

  /*
   * Máximo dos partidos Flashscore
   * nuevos por pasada.
   *
   * Con el intervalo anterior:
   * máximo teórico ~= 12/minuto.
   */
  private readonly maxNewPerPass =
    2;

  /*
   * Una roja confirmada no desaparece.
   *
   * Mientras el partido continúe live,
   * podemos reutilizarla.
   */
  private readonly positiveCacheMs =
    2 *
    60 *
    60 *
    1000;

  /*
   * Un negativo se vuelve a comprobar
   * bastante antes.
   */
  private readonly negativeCacheMs =
    30_000;

  constructor(
    private readonly getLiveMatches:
      GetLiveMatches,

    private readonly incidentProvider:
      MatchIncidentProvider,

    private readonly detector:
      RedCardDetector =
        new RedCardDetector()
  ) {}

  public async execute(
    filters:
      RedCardRadarFilters = {}
  ): Promise<
    RedCardRadarMatch[]
  > {

    const matches =
      await this.getLiveMatches
        .execute({
          country:
            filters.country,
        });

    /*
     * TODOS los partidos cuya fuente
     * de incidentes podamos consultar.
     *
     * Ya no usamos cursor ni una muestra
     * de 2 partidos.
     */
    const candidates =
      matches.filter(
        match =>
          this.findSupportedSource(
            match
          ) !==
          null
      );

    const result:
      RedCardRadarMatch[] =
      [];

    /*
     * Volvemos al comportamiento que
     * daba cobertura completa.
     *
     * scanWithCache() sigue protegiéndonos:
     *
     * - negativo reciente -> no red
     * - positivo -> no red
     * - mismo partido inflight -> no red
     *
     * Por tanto "escanear todos" NO
     * significa necesariamente hacer
     * network request para todos.
     */
    const concurrency =
      5;

    for (
      let index = 0;
      index <
        candidates.length;
      index +=
        concurrency
    ) {

      const chunk =
        candidates.slice(
          index,
          index +
            concurrency
        );

      const scanned =
        await Promise.all(
          chunk.map(
            match =>
              this.scanWithCache(
                match
              )
          )
        );

      for (
        const item
        of scanned
      ) {

        if (!item) {
          continue;
        }

        result.push(
          item
        );
      }
    }

    this.cleanupCache();

    console.log(
      "[FlashscoreRedCards]",
      `candidates=${candidates.length}`,
      `confirmed=${result.length}`,
      `cache=${this.cache.size}`
    );

    return result;
  }

  private selectDeepBatch(
    candidates:
      LiveMatch[],

    limit:
      number
  ): LiveMatch[] {

    if (
      candidates.length ===
        0 ||
      limit <=
        0
    ) {
      return [];
    }

    const selected:
      LiveMatch[] =
      [];

    const total =
      candidates.length;

    let index =
      this.scanCursor %
      total;

    let checked =
      0;

    const now =
      Date.now();

    while (
      checked <
        total &&
      selected.length <
        limit
    ) {

      const match =
        candidates[
          index
        ];

      const source =
        this.findSupportedSource(
          match
        );

      if (
        source
      ) {

        const key =
          this.sourceKey(
            source
          );

        const cached =
          this.cache.get(
            key
          );

        const fresh =
          cached &&
          cached.expiresAt >
            now;

        const running =
          this.inflight.has(
            key
          );

        /*
         * Solo seleccionamos algo que
         * realmente necesite refrescarse.
         */
        if (
          !fresh &&
          !running
        ) {
          selected.push(
            match
          );
        }
      }

      index =
        (
          index +
          1
        ) %
        total;

      checked +=
        1;
    }

    /*
     * La siguiente pasada continúa
     * desde aquí.
     */
    this.scanCursor =
      index;

    return selected;
  }

  private findSupportedSource(
    match:
      LiveMatch
  ): MatchSource | null {

    return (
      match.sources.find(
        source =>
          this.incidentProvider
            .supports(
              source
            )
      ) ??
      null
    );
  }

  private sourceKey(
    source:
      MatchSource
  ): string {

    return (
      `${source.provider}:${source.externalId}`
    );
  }

  private async scanWithCache(
    match:
      LiveMatch
  ): Promise<
    RedCardRadarMatch |
    null
  > {

    const source =
      this.findSupportedSource(
        match
      );

    if (!source) {
      return null;
    }

    const key =
      this.sourceKey(
        source
      );

    const cached =
      this.cache.get(
        key
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {

      return cached.redCards
        ? this.buildResult(
            match,
            cached.redCards
          )
        : null;
    }

    /*
     * Otro consumidor ya pidió
     * exactamente este partido.
     */
    const existing =
      this.inflight.get(
        key
      );

    if (
      existing
    ) {
      return existing;
    }

    const running =
      this.scanNetwork(
        match,
        source
      );

    this.inflight.set(
      key,
      running
    );

    try {

      const result =
        await running;

      this.cache.set(
        key,
        {
          redCards:
            result
              ?.redCards ??
            null,

          expiresAt:
            Date.now() +
            (
              result
                ? this
                    .positiveCacheMs
                : this
                    .negativeCacheMs
            ),
        }
      );

      return result;

    } catch (
      error
    ) {

      /*
       * Un error NO se guarda como
       * "sin tarjeta roja".
       *
       * Desconocido != negativo.
       */
      console.warn(
        "[FlashscoreRedCards]",
        source.externalId,
        error instanceof
          Error
          ? error.message
          : error
      );

      return null;

    } finally {

      if (
        this.inflight.get(
          key
        ) ===
        running
      ) {
        this.inflight.delete(
          key
        );
      }
    }
  }

  private async scanNetwork(
    match:
      LiveMatch,

    source:
      MatchSource
  ): Promise<
    RedCardRadarMatch |
    null
  > {

    const incidents =
      await this
        .incidentProvider
        .getIncidents(
          source
        );

    const redCards =
      incidents.filter(
        incident =>
          this.detector
            .isRedCard(
              incident
            )
      );

    if (
      redCards.length ===
      0
    ) {
      return null;
    }

    const home =
      redCards.filter(
        incident =>
          incident.side ===
          "home"
      ).length;

    const away =
      redCards.filter(
        incident =>
          incident.side ===
          "away"
      ).length;

    const unknown =
      redCards.length -
      home -
      away;

    return this.buildResult(
      match,
      {
        home,
        away,
        unknown,

        incidents:
          redCards,
      }
    );
  }

  private buildResult(
    match:
      LiveMatch,

    redCards:
      CachedRedCards
  ): RedCardRadarMatch {

    return {
      match: {
        ...match,

        dataAvailability: {
          ...match
            .dataAvailability,

          events:
            true,

          redCards:
            true,
        },
      },

      redCards,
    };
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
      of this.cache
    ) {

      if (
        entry.expiresAt <=
          now
      ) {
        this.cache.delete(
          key
        );
      }
    }
  }
}
