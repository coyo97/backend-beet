import type {
  LiveMatch,
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  GetLiveMatches,
} from "../../../football/application/use-cases/GetLiveMatches";

import type {
  MatchContext,
} from "../../../match-context/domain/entities/MatchContext";

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

    pending:
    number;

  refreshed:
    number;

  opportunities:
    MatchOpportunity[];
}

interface ContextCacheEntry {
  context:
    MatchContext |
    null;

  expiresAt:
    number;
}

export class GetLiveOpportunities {

	  private readonly contextCache =
    new Map<
      string,
      ContextCacheEntry
    >();

  private readonly contextInflight =
    new Map<
      string,
      Promise<
        MatchContext |
        null
      >
    >();

  private scanCursor =
    0;

    /*
   * =====================================================
   * GLOBAL DEEP-CONTEXT BUDGET
   * =====================================================
   *
   * Este objeto GetLiveOpportunities es singleton dentro
   * del backend.
   *
   * Por tanto este presupuesto es compartido por:
   *
   * - móvil 1
   * - móvil 2
   * - móvil 3
   * - endpoints concurrentes
   *
   * Ningún cliente puede saltarse el límite.
   * =====================================================
   */

  private activeRefreshes =
    0;

  private refreshHistory:
    number[] =
    [];

  private readonly refreshWindowMs =
    60_000;

  /*
   * Conservador inicialmente:
   *
   * máximo 6 contextos profundos nuevos
   * por minuto en TODO el backend.
   */
  private readonly maxRefreshesPerWindow =
    6;

  /*
   * Solo un contexto profundo nuevo
   * ejecutándose simultáneamente.
   */
  private readonly maxConcurrentRefreshes =
    1;

  /*
   * Tabla/forma/H2H no necesitan
   * refrescarse cada 30 segundos.
   *
   * El marcador/minuto se toma
   * siempre del LiveMatch actual.
   */
  private readonly contextCacheMs =
    60 *
    60 *
    1000;

  /*
   * Si un partido no tiene contexto
   * disponible, esperamos un poco antes
   * de volver a intentarlo.
   */
  private readonly unavailableCacheMs =
    5 *
    60 *
    1000;
  
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

    /*
     * Todos los partidos que pasan
     * los filtros explícitos del usuario
     * permanecen como candidatos.
     *
     * Ya NO existe:
     *
     * filteredMatches.slice(0, 60)
     */
    const candidates =
      matches.filter(
        match =>
          this.acceptBeforeAnalysis(
            match,
            config
          )
      );

    /*
     * Compatibilidad:
     *
     * seguimos aceptando scanLimit,
     * pero ahora significa:
     *
     * "cuántos contextos profundos
     * refrescar como máximo en ESTA
     * ejecución"
     *
     * NO significa:
     * "cuántos partidos existen".
     */
    const refreshLimit =
      Math.min(
        Math.max(
          config.scanLimit ??
            4,
          1
        ),
        6
      );

    /*
     * El contexto profundo puede disparar
     * varias llamadas internas.
     *
     * Mantenemos una concurrencia muy
     * pequeña para no saturar SofaScore,
     * Flashscore o FotMob.
     */
    const concurrency =
      Math.min(
        Math.max(
          config.concurrency ??
            2,
          1
        ),
        2
      );

       const availableSlots =
      this.getAvailableRefreshSlots();

    const refreshBatch =
      this.selectRefreshBatch(
        candidates,
        Math.min(
          refreshLimit,
          availableSlots
        )
      );

    let refreshed =
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
            refreshBatch.length
          ) {
            return;
          }

          const didRefresh =
            await this
              .refreshContext(
                refreshBatch[
                  index
                ]
              );

          if (
            didRefresh
          ) {
            refreshed +=
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
              refreshBatch.length
            ),
        },
        () =>
          worker()
      )
    );

    /*
     * Recalculamos el score con el
     * LiveMatch ACTUAL.
     *
     * Solo reutilizamos el contexto.
     *
     * Así marcador/minuto no quedan
     * congelados en caché.
     */
    const analyzed:
      MatchOpportunity[] =
      [];

    let unavailable =
      0;

    const now =
      Date.now();

    for (
      const match
      of candidates
    ) {

      const key =
        this.createMatchKey(
          match
        );

      const cached =
        this.contextCache.get(
          key
        );

      if (
        !cached ||
        cached.expiresAt <=
          now
      ) {
        continue;
      }

      if (
        !cached.context
      ) {
        unavailable +=
          1;

        continue;
      }

      analyzed.push(
        this.scorer.score(
          match,
          cached.context
        )
      );
    }

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

    const pending =
      Math.max(
        candidates.length -
          analyzed.length -
          unavailable,
        0
      );

    this.cleanupCache();

    console.log(
      "[Opportunities]",
      `live=${matches.length}`,
      `candidates=${candidates.length}`,
      `analyzed=${analyzed.length}`,
      `pending=${pending}`,
      `refreshBatch=${refreshBatch.length}`,
      `opportunities=${opportunities.length}`
    );

    return {
      totalLive:
        matches.length,

      candidates:
        candidates.length,

      analyzed:
        analyzed.length,

      unavailable,

      pending,

refreshed,

      opportunities,
    };
  }

  private async refreshContext(
    match:
      LiveMatch
  ): Promise<boolean> {

    const key =
      this.createMatchKey(
        match
      );

    const now =
      Date.now();

    const cached =
      this.contextCache.get(
        key
      );

    /*
     * Ya tenemos contexto suficientemente
     * reciente.
     *
     * No consumimos presupuesto.
     */
    if (
      cached &&
      cached.expiresAt >
        now
    ) {
      return false;
    }

    /*
     * Otro request ya está obteniendo
     * exactamente este partido.
     *
     * Reutilizamos la promesa y NO
     * consumimos otro slot.
     */
    const existing =
      this.contextInflight.get(
        key
      );

    if (
      existing
    ) {
      await existing;

      return false;
    }

    /*
     * Aquí está la protección global.
     */
    if (
      !this.tryAcquireRefreshPermit()
    ) {
      return false;
    }

    const running =
      this.loadContext(
        match
      );

    this.contextInflight.set(
      key,
      running
    );

    try {
      const context =
        await running;

      this.contextCache.set(
        key,
        {
          context,

          expiresAt:
            Date.now() +
            (
              context
                ? this.contextCacheMs
                : this.unavailableCacheMs
            ),
        }
      );

      return true;
    } finally {
      if (
        this.contextInflight.get(
          key
        ) ===
        running
      ) {
        this.contextInflight.delete(
          key
        );
      }

      this.releaseRefreshPermit();
    }
  }

  private async loadContext(
    match:
      LiveMatch
  ): Promise<
    MatchContext |
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
        return await this
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
      } catch (
        error
      ) {

        if (
          process.env
            .NODE_ENV !==
          "production"
        ) {
          console.warn(
            "[GetLiveOpportunities.context]",
            source.provider,
            source.externalId,
            error instanceof Error
              ? error.message
              : error
          );
        }
      }
    }

    return null;
  }

  private selectRefreshBatch(
    matches:
      LiveMatch[],

    limit:
      number

  ): LiveMatch[] {

    if (
      matches.length ===
      0
    ) {
      return [];
    }
	    if (
      limit <=
      0
    ) {
      return [];
    }

    const now =
      Date.now();

    const selected:
      LiveMatch[] =
      [];

    const total =
      matches.length;

    let checked =
      0;

    let index =
      this.scanCursor %
      total;

    while (
      checked <
        total &&
      selected.length <
        limit
    ) {

      const match =
        matches[
          index
        ];

      const key =
        this.createMatchKey(
          match
        );

      const cached =
        this.contextCache.get(
          key
        );

      const fresh =
        cached &&
        cached.expiresAt >
          now;

      if (
        !fresh
      ) {
        selected.push(
          match
        );
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
     * La siguiente ejecución empieza
     * donde terminó esta.
     *
     * Así no analizamos siempre
     * "los primeros 4".
     */
    this.scanCursor =
      index;

    return selected;
  }

  private createMatchKey(
    match:
      LiveMatch
  ): string {

    const sources =
      match.sources
        .map(
          source =>
            `${source.provider}:${source.externalId}`
        )
        .sort()
        .join(
          "|"
        );

    if (
      sources
    ) {
      return sources;
    }

    return [
      match
        .competition
        .name,

      match.home.name,

      match.away.name,

      match.kickoffAt,
    ]
      .join(
        "::"
      )
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase();
  }

  private cleanupCache():
    void {

    const cutoff =
      Date.now() -
      60 *
      60 *
      1000;

    for (
      const [
        key,
        entry,
      ]
      of this.contextCache
    ) {

      if (
        entry.expiresAt <
          cutoff &&
        !this.contextInflight.has(
          key
        )
      ) {
        this.contextCache.delete(
          key
        );
      }
    }
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
    private pruneRefreshHistory(
    now:
      number = Date.now()
  ): void {

    const minimumTimestamp =
      now -
      this.refreshWindowMs;

    this.refreshHistory =
      this.refreshHistory.filter(
        timestamp =>
          timestamp >
          minimumTimestamp
      );
  }

  private getAvailableRefreshSlots():
    number {

    const now =
      Date.now();

    this.pruneRefreshHistory(
      now
    );

    const byWindow =
      Math.max(
        0,
        this.maxRefreshesPerWindow -
          this.refreshHistory.length
      );

    const byConcurrency =
      Math.max(
        0,
        this.maxConcurrentRefreshes -
          this.activeRefreshes
      );

    return Math.min(
      byWindow,
      byConcurrency
    );
  }

  private tryAcquireRefreshPermit():
    boolean {

    const now =
      Date.now();

    this.pruneRefreshHistory(
      now
    );

    if (
      this.activeRefreshes >=
        this.maxConcurrentRefreshes
    ) {
      console.log(
        "[Opportunities BUDGET]",
        "concurrency-limit"
      );

      return false;
    }

    if (
      this.refreshHistory.length >=
        this.maxRefreshesPerWindow
    ) {
      console.log(
        "[Opportunities BUDGET]",
        "minute-limit",
        `used=${this.refreshHistory.length}/${this.maxRefreshesPerWindow}`
      );

      return false;
    }

    this.activeRefreshes +=
      1;

    this.refreshHistory.push(
      now
    );

    console.log(
      "[Opportunities BUDGET]",
      "acquired",
      `used=${this.refreshHistory.length}/${this.maxRefreshesPerWindow}`,
      `active=${this.activeRefreshes}`
    );

    return true;
  }

  private releaseRefreshPermit():
    void {

    this.activeRefreshes =
      Math.max(
        0,
        this.activeRefreshes -
          1
      );
  }
}
