import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  MatchEventSnapshot,
} from "../../domain/entities/MatchEventSnapshot";

import type {
  MatchTrackingDecision,
  MatchTrackingSignals,
} from "../../domain/entities/MatchTrackingDecision";

import {
  MatchTrackingPolicy,
} from "../../domain/services/MatchTrackingPolicy";

import type {
  CaptureMatchEvents,
} from "../use-cases/CaptureMatchEvents";

export interface MatchTrackingRequest {
  match:
    LiveMatch;

  signals:
    MatchTrackingSignals;

  force?:
    boolean;
}

export interface MatchTrackingResult {
  captured:
    boolean;

  skippedReason:
    | "not-relevant"
    | "throttled"
    | "inflight"
    | "budget"
    | "no-incident-source"
    | null;

  decision:
    MatchTrackingDecision;

  snapshot:
    MatchEventSnapshot |
    null;
}

export class MatchEventTrackingCoordinator {

  private readonly nextAllowedAt =
    new Map<
      string,
      number
    >();

  private readonly inflight =
    new Map<
      string,
      Promise<
        MatchEventSnapshot |
        null
      >
    >();

  /*
   * =========================================
   * GLOBAL INCIDENT BUDGET
   * =========================================
   *
   * Igual que Opportunity Radar:
   *
   * ningún móvil puede saltarse este límite.
   */
  private activeRefreshes =
    0;

  private refreshHistory:
    number[] =
    [];

  private readonly refreshWindowMs =
    60_000;

  /*
   * Empezamos conservadores.
   *
   * Máximo:
   * 6 peticiones NUEVAS de incidents/minuto.
   */
  private readonly maxRefreshesPerWindow =
    6;

  /*
   * Una sola petición de incidents
   * ejecutándose al mismo tiempo.
   */
  private readonly maxConcurrentRefreshes =
    1;

  /*
   * Cursor para repartir oportunidades
   * y no seguir siempre las primeras.
   */
  private batchCursor =
    0;

  constructor(
    private readonly captureMatchEvents:
      CaptureMatchEvents,

    private readonly policy:
      MatchTrackingPolicy =
        new MatchTrackingPolicy()
  ) {}

  public async track(
    match:
      LiveMatch,

    signals:
      MatchTrackingSignals,

    force =
      false
  ): Promise<
    MatchTrackingResult
  > {

    const decision =
      this.policy
        .evaluate(
          match,
          signals
        );

    if (
      !decision.track
    ) {
      return {
        captured:
          false,

        skippedReason:
          "not-relevant",

        decision,

        snapshot:
          null,
      };
    }

    const key =
      this.matchKey(
        match
      );

    if (
      this.inflight.has(
        key
      )
    ) {
      return {
        captured:
          false,

        skippedReason:
          "inflight",

        decision,

        snapshot:
          null,
      };
    }

    const now =
      Date.now();

    const allowedAt =
      this.nextAllowedAt
        .get(
          key
        ) ??
      0;

    if (
      !force &&
      now <
        allowedAt
    ) {
      return {
        captured:
          false,

        skippedReason:
          "throttled",

        decision,

        snapshot:
          null,
      };
    }

    /*
     * Protección GLOBAL.
     */
    if (
      !this.tryAcquirePermit()
    ) {
      return {
        captured:
          false,

        skippedReason:
          "budget",

        decision,

        snapshot:
          null,
      };
    }

    this.nextAllowedAt
      .set(
        key,
        now +
          (
            decision
              .refreshAfterMs ??
            60_000
          )
      );

    const request =
      this.captureMatchEvents
        .execute(
          match
        );

    this.inflight.set(
      key,
      request
    );

    try {
      const snapshot =
        await request;

      if (!snapshot) {
        return {
          captured:
            false,

          skippedReason:
            "no-incident-source",

          decision,

          snapshot:
            null,
        };
      }

      return {
        captured:
          true,

        skippedReason:
          null,

        decision,

        snapshot,
      };

    } catch (
      error
    ) {

      /*
       * No esperamos todo el intervalo
       * si fue fallo de red.
       */
      this.nextAllowedAt
        .set(
          key,
          Date.now() +
            10_000
        );

      throw error;

    } finally {

      if (
        this.inflight.get(
          key
        ) ===
        request
      ) {
        this.inflight.delete(
          key
        );
      }

      this.releasePermit();
    }
  }

  /*
   * Procesa varios partidos de forma
   * JUSTA.
   *
   * No empieza siempre desde índice 0.
   */
  public async trackMany(
    requests:
      MatchTrackingRequest[]
  ): Promise<
    MatchTrackingResult[]
  > {

    if (
      requests.length ===
      0
    ) {
      return [];
    }

    const results:
      MatchTrackingResult[] =
      [];

    const total =
      requests.length;

    let checked =
      0;

    let index =
      this.batchCursor %
      total;

    while (
      checked <
      total
    ) {

      const request =
        requests[
          index
        ];

      try {
        const result =
          await this.track(
            request.match,
            request.signals,
            request.force ??
              false
          );

        results.push(
          result
        );

      } catch (
        error
      ) {

        console.warn(
          "[MatchEventTracking]",
          request.match.home.name,
          "vs",
          request.match.away.name,
          error instanceof Error
            ? error.message
            : error
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
 * Aunque recorramos todo el array,
 * la próxima ejecución empieza un
 * elemento después.
 *
 * Evita favorecer permanentemente
 * los mismos partidos cuando vuelve
 * a abrirse el presupuesto.
 */
this.batchCursor =
  (
    this.batchCursor +
    1
  ) %
  total;

return results;

  }

  public forget(
    match:
      LiveMatch
  ): void {

    const key =
      this.matchKey(
        match
      );

    this.nextAllowedAt
      .delete(
        key
      );

    this.inflight
      .delete(
        key
      );
  }

  private tryAcquirePermit():
    boolean {

    const now =
      Date.now();

    const cutoff =
      now -
      this.refreshWindowMs;

    this.refreshHistory =
      this.refreshHistory
        .filter(
          timestamp =>
            timestamp >
            cutoff
        );

    if (
      this.activeRefreshes >=
      this.maxConcurrentRefreshes
    ) {
      return false;
    }

    if (
      this.refreshHistory
        .length >=
      this.maxRefreshesPerWindow
    ) {
      return false;
    }

    this.activeRefreshes +=
      1;

    this.refreshHistory.push(
      now
    );

    return true;
  }

  private releasePermit():
    void {

    this.activeRefreshes =
      Math.max(
        this.activeRefreshes -
          1,
        0
      );
  }

  private matchKey(
    match:
      LiveMatch
  ): string {

    /*
     * Preferimos una fuente conocida
     * estable antes que concatenar todas.
     *
     * Si después FotMob agrega otra source,
     * no debería cambiar la identidad.
     */
    const preferredProviders =
      [
        "flashscore",
        "sofascore",
        "api-football",
        "fotmob",
        "bookmaker",
      ];

    for (
      const provider
      of preferredProviders
    ) {

      const source =
        match.sources
          .find(
            candidate =>
              candidate.provider ===
              provider
          );

      if (source) {
        return (
          `${source.provider}:` +
          source.externalId
        );
      }
    }

    return [
      match.competition.name,
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
}
