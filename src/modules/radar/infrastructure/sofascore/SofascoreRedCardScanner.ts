import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import {
  SofascoreSessionClient,
  type SofascoreApiLiveEvent,
  type SofascoreIncident,
} from "../../../football/infrastructure/providers/sofascore-browser/SofascoreSessionClient";

export type SofascoreRedCardType =
  | "red"
  | "second-yellow-red"
  | "unknown-red";

export interface SofascoreRedCardEvent {
  eventId:
    string | null;

  side:
    "home" |
    "away" |
    null;

  minute:
    number | null;

  addedTime:
    number | null;

  playerId:
    string | null;

  playerName:
    string | null;

  type:
    SofascoreRedCardType;
}

export interface SofascoreScannedRedCardMatch {
  match:
    LiveMatch;

  sofascoreExternalId:
    string;

  homeRedCards:
    number;

  awayRedCards:
    number;

  events:
    SofascoreRedCardEvent[];
}

interface CacheEntry {
  value:
    SofascoreScannedRedCardMatch;

  expiresAt:
    number;
}

interface Candidate {
  match:
    LiveMatch;

  externalId:
    string;

  liveEvent:
    SofascoreApiLiveEvent;

  homeRedCards:
    number;

  awayRedCards:
    number;
}

export class SofascoreRedCardScanner {
  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  constructor(
    private readonly client:
      SofascoreSessionClient,

    private readonly cacheMs =
      10_000,

    private readonly concurrency =
      4
  ) {}

  public async scan(
    matches:
      LiveMatch[]
  ): Promise<
    SofascoreScannedRedCardMatch[]
  > {

    /*
     * ========================================
     * PASO 1
     * PARTIDOS QUE TIENEN FUENTE SOFASCORE
     * ========================================
     */
    const sofaMatches =
      this.getSofascoreMatches(
        matches
      );

    if (
      sofaMatches.length ===
      0
    ) {
      return [];
    }

    /*
     * ========================================
     * PASO 2
     * UN ÚNICO SNAPSHOT LIVE
     * ========================================
     *
     * Normalmente esto sale de la misma
     * cache que ya utilizó /football/live.
     *
     * NO hacemos una consulta por partido.
     */
    let liveEvents:
      SofascoreApiLiveEvent[];

    try {
      liveEvents =
        await this.client
          .getLiveEvents();
} catch (
  error
) {
  console.warn(
    "[SofascoreRedCardScanner] live snapshot unavailable",
    error instanceof Error
      ? error.message
      : error
  );

  /*
   * Importante:
   *
   * Propagamos el error para que el
   * agregador sepa que SofaScore NO
   * pudo cubrir estos partidos.
   *
   * En ese caso FotMob podrá entrar
   * como fallback.
   */
  throw error;
}

    const liveEventById =
      new Map<
        string,
        SofascoreApiLiveEvent
      >();

    for (
      const event
      of liveEvents
    ) {
      if (
        typeof event.id !==
        "number"
      ) {
        continue;
      }

      liveEventById.set(
        String(
          event.id
        ),
        event
      );
    }

    /*
     * ========================================
     * PASO 3
     * PREFILTRO LOCAL DE ROJAS
     * ========================================
     *
     * Aquí está la optimización importante.
     *
     * De 500 partidos podemos quedar,
     * por ejemplo, con solo 18.
     */
    const candidates:
      Candidate[] =
      [];

    for (
      const sofaMatch
      of sofaMatches
    ) {
      const liveEvent =
        liveEventById.get(
          sofaMatch.externalId
        );

      if (
        !liveEvent
      ) {
        continue;
      }

      const homeRedCards =
        this.normalizeRedCards(
          liveEvent.homeRedCards
        );

      const awayRedCards =
        this.normalizeRedCards(
          liveEvent.awayRedCards
        );

      /*
       * Sin roja:
       *
       * NO consultamos /incidents.
       */
      if (
        homeRedCards +
          awayRedCards ===
        0
      ) {
        continue;
      }

      candidates.push({
        match:
          sofaMatch.match,

        externalId:
          sofaMatch.externalId,

        liveEvent,

        homeRedCards,

        awayRedCards,
      });
    }

    console.log(
      "[SofascoreRedCardScanner]",
      `sofascore=${sofaMatches.length}`,
      `live=${liveEvents.length}`,
      `redCandidates=${candidates.length}`
    );

    if (
      candidates.length ===
      0
    ) {
      return [];
    }

    /*
     * ========================================
     * PASO 4
     * INCIDENTS SOLO PARA LOS QUE TIENEN ROJA
     * ========================================
     */
    const results:
      SofascoreScannedRedCardMatch[] =
        [];

    let cursor =
      0;

    const worker =
      async () => {

        while (
          cursor <
          candidates.length
        ) {
          const index =
            cursor++;

          const candidate =
            candidates[
              index
            ];

          const detection =
            await this.scanOne(
              candidate
            );

          results.push(
            detection
          );
        }
      };

    const workerCount =
      Math.min(
        this.concurrency,
        candidates.length
      );

    await Promise.all(
      Array.from(
        {
          length:
            workerCount,
        },

        () =>
          worker()
      )
    );

    return results;
  }

  /*
   * ========================================
   * OBTENER MATCHES SOFASCORE
   * ========================================
   */
  private getSofascoreMatches(
    matches:
      LiveMatch[]
  ): Array<{
    match:
      LiveMatch;

    externalId:
      string;
  }> {

    const seen =
      new Set<
        string
      >();

    const result:
      Array<{
        match:
          LiveMatch;

        externalId:
          string;
      }> =
        [];

    for (
      const match
      of matches
    ) {
      const source =
        match.sources.find(
          item =>
            item.provider ===
            "sofascore"
        );

      if (
        !source
      ) {
        continue;
      }

      if (
        seen.has(
          source.externalId
        )
      ) {
        continue;
      }

      seen.add(
        source.externalId
      );

      result.push({
        match,

        externalId:
          source.externalId,
      });
    }

    return result;
  }

  /*
   * ========================================
   * ANALIZAR SOLO UN PARTIDO CON ROJA
   * ========================================
   *
   * Ya sabemos ANTES de entrar aquí
   * que el snapshot live indicó roja.
   *
   * /incidents se utiliza únicamente
   * para obtener detalles.
   */
  private async scanOne(
    candidate:
      Candidate
  ): Promise<
    SofascoreScannedRedCardMatch
  > {

    const cached =
      this.cache.get(
        candidate.externalId
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.value;
    }

    const numericId =
      Number(
        candidate.externalId
      );

    /*
     * Este caso prácticamente no debería
     * ocurrir porque el ID viene del evento
     * live de SofaScore.
     *
     * Aun así conservamos los contadores
     * detectados en live.
     */
    if (
      !Number.isFinite(
        numericId
      )
    ) {
      return this.buildSummaryOnly(
        candidate
      );
    }

    let incidents:
      SofascoreIncident[] =
        [];

    try {
      incidents =
        await this.client
          .getIncidents(
            numericId
          );
    } catch (
      error
    ) {
      /*
       * MUY IMPORTANTE:
       *
       * Si /incidents falla, NO ocultamos
       * la roja.
       *
       * Ya fue confirmada por
       * homeRedCards / awayRedCards
       * del snapshot live.
       */
      console.warn(
        "[SofascoreRedCardScanner] incidents unavailable",
        candidate.externalId,
        error instanceof Error
          ? error.message
          : error
      );
    }

    const redEvents =
      incidents
        .map(
          incident =>
            this.mapRedCard(
              incident
            )
        )
        .filter(
          (
            event
          ): event is
            SofascoreRedCardEvent =>
              event !==
              null
        );

    const incidentHome =
      redEvents.filter(
        event =>
          event.side ===
          "home"
      ).length;

    const incidentAway =
      redEvents.filter(
        event =>
          event.side ===
          "away"
      ).length;

    /*
     * Usamos el mayor valor entre:
     *
     * - contador live
     * - incidents
     *
     * Así una pequeña diferencia temporal
     * entre endpoints no nos hace perder
     * una tarjeta.
     */
    const homeRedCards =
      Math.max(
        candidate.homeRedCards,
        incidentHome
      );

    const awayRedCards =
      Math.max(
        candidate.awayRedCards,
        incidentAway
      );

    const result:
      SofascoreScannedRedCardMatch =
      {
        match:
          candidate.match,

        sofascoreExternalId:
          candidate.externalId,

        homeRedCards,

        awayRedCards,

        events:
          redEvents,
      };

    this.cache.set(
      candidate.externalId,
      {
        value:
          result,

        expiresAt:
          Date.now() +
          this.cacheMs,
      }
    );

    return result;
  }

  /*
   * ========================================
   * FALLBACK
   * ========================================
   *
   * Sabemos que existe roja por el live,
   * aunque todavía no tengamos el detalle.
   */
  private buildSummaryOnly(
    candidate:
      Candidate
  ): SofascoreScannedRedCardMatch {

    const result:
      SofascoreScannedRedCardMatch =
      {
        match:
          candidate.match,

        sofascoreExternalId:
          candidate.externalId,

        homeRedCards:
          candidate.homeRedCards,

        awayRedCards:
          candidate.awayRedCards,

        events:
          [],
      };

    this.cache.set(
      candidate.externalId,
      {
        value:
          result,

        expiresAt:
          Date.now() +
          this.cacheMs,
      }
    );

    return result;
  }

  private normalizeRedCards(
    value:
      number | null | undefined
  ): number {

    if (
      typeof value !==
        "number" ||
      !Number.isFinite(
        value
      ) ||
      value <
        0
    ) {
      return 0;
    }

    return Math.trunc(
      value
    );
  }

  /*
   * ========================================
   * MAPEO DEL INCIDENTE
   * ========================================
   */
  private mapRedCard(
    incident:
      SofascoreIncident
  ): SofascoreRedCardEvent | null {

    if (
      incident.incidentType !==
      "card"
    ) {
      return null;
    }

    const cardClass =
      String(
        incident.incidentClass ??
        ""
      )
        .toLowerCase()
        .replace(
          /[^a-z]/g,
          ""
        );

    /*
     * Ejemplos:
     *
     * red
     * redCard
     * yellowRed
     * yellowRedCard
     */
    if (
      !cardClass.includes(
        "red"
      )
    ) {
      return null;
    }

    let type:
      SofascoreRedCardType =
        "unknown-red";

    if (
      cardClass.includes(
        "yellow"
      )
    ) {
      type =
        "second-yellow-red";
    } else if (
      cardClass.includes(
        "red"
      )
    ) {
      type =
        "red";
    }

    return {
      eventId:
        typeof incident.id ===
          "number"
          ? String(
              incident.id
            )
          : null,

      side:
        incident.isHome ===
        true
          ? "home"
          : incident.isHome ===
            false
            ? "away"
            : null,

      minute:
        typeof incident.time ===
          "number"
          ? incident.time
          : null,

      addedTime:
        typeof incident.addedTime ===
          "number"
          ? incident.addedTime
          : null,

      playerId:
        typeof incident.player
          ?.id ===
          "number"
          ? String(
              incident.player.id
            )
          : null,

      playerName:
        incident.player
          ?.name ??
        null,

      type,
    };
  }
}
