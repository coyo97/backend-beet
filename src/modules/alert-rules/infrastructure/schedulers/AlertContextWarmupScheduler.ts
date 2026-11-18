import type {
  GetLiveOpportunities,
} from "../../../opportunity-filter/application/use-cases/GetLiveOpportunities";

import {
  alertRulesRepository,
} from "../../alertRulesModule";

import {
  PreviewFavoriteAlertRules,
} from "../../application/services/PreviewFavoriteAlertRules";

export class AlertContextWarmupScheduler {

  private interval:
    NodeJS.Timeout | null = null;

  private initialTimer:
    NodeJS.Timeout | null = null;

  private running = false;

  private scanNumber = 0;

  /*
   * NUEVO:
   * Evaluador de prueba.
   *
   * No envía push ni modifica
   * reglas existentes.
   */
  private readonly rulesPreview =
    new PreviewFavoriteAlertRules();

  /*
   * Dos contextos nuevos como
   * máximo por ejecución.
   */
  private readonly scanLimit = 2;

  /*
   * Tres minutos entre escaneos.
   */
  private readonly intervalMs =
    3 * 60 * 1000;

  constructor(
    private readonly opportunities:
      GetLiveOpportunities
  ) {}

  public start(): void {

    if (
      process.env
        .ALERT_CONTEXT_WARMUP_ENABLED !==
      "true"
    ) {
      console.log(
        "[AlertContextWarmup] disabled"
      );

      return;
    }

    if (
      this.interval ||
      this.initialTimer
    ) {
      return;
    }

    console.log(
      "[AlertContextWarmup] started",
      `interval=${this.intervalMs}ms`,
      `scanLimit=${this.scanLimit}`
    );

    /*
     * Arranque escalonado:
     * dejamos que los radares
     * realicen primero sus
     * escaneos iniciales.
     */
    this.initialTimer =
      setTimeout(() => {
        this.initialTimer = null;
        void this.tick();
      }, 60_000);

    this.interval =
      setInterval(() => {
        void this.tick();
      }, this.intervalMs);
  }

  public stop(): void {

    if (this.initialTimer) {
      clearTimeout(
        this.initialTimer
      );

      this.initialTimer = null;
    }

    if (this.interval) {
      clearInterval(
        this.interval
      );

      this.interval = null;
    }

    console.log(
      "[AlertContextWarmup] stopped"
    );
  }

  private async tick():
    Promise<void> {

    /*
     * Nunca solapar ejecuciones.
     */
    if (this.running) {
      console.warn(
        "[AlertContextWarmup] previous scan still running"
      );

      return;
    }

    this.running = true;
    this.scanNumber += 1;

    const startedAt =
      Date.now();

    try {

      /*
       * EXISTENTE:
       *
       * Reutilizar la instancia
       * compartida de oportunidades.
       *
       * Conservamos todos los límites
       * y configuraciones anteriores.
       */
      const result =
        await this.opportunities.execute({
          mode: "all",

          scanLimit:
            this.scanLimit,

          concurrency: 1,

          minDataQuality: 0,

          requireTable: false,

          limit: 200,

          skipEventTracking: true,

          skipLateGoalAnalysis: true,
        });

      /*
       * NUEVO:
       *
       * Evaluar reglas de favoritos
       * únicamente en modo preview.
       *
       * La bandera está desactivada
       * por defecto.
       *
       * No consultar proveedores.
       * No enviar notificaciones.
       * No modificar MongoDB.
       */
      if (
        process.env
          .ALERT_RULES_PREVIEW_ENABLED ===
        "true"
      ) {

        try {

          /*
           * Una única consulta Mongo
           * por ciclo del scheduler.
           *
           * Recuperar reglas activas
           * de fase live.
           */
          const rules =
            await alertRulesRepository
              .findEnabledByPhase(
                "live"
              );

          /*
           * Reutilizar exactamente
           * las oportunidades obtenidas
           * en este mismo ciclo.
           */
          const preview =
            this.rulesPreview.execute(
              result.opportunities,
              rules
            );

          /*
           * Solo estadísticas agregadas.
           *
           * No imprimir identificadores
           * ni datos personales.
           */
          console.log(
            [
              "[AlertRulesPreview]",
              `scan=${this.scanNumber}`,
              `rules=${rules.length}`,
              `eligibleRules=${preview.eligibleRules}`,
              `opportunities=${preview.opportunitiesReceived}`,
              `eligibleOpportunities=${preview.eligibleOpportunities}`,
              `evaluations=${preview.evaluations}`,
              `matches=${preview.matches.length}`,
            ].join(" ")
          );

        } catch (error) {

          /*
           * Un fallo de MongoDB o del
           * evaluador no debe interrumpir
           * el scheduler de contexto.
           */
          console.error(
            "[AlertRulesPreview] failed",
            error
          );
        }
      }

      /*
       * EXISTENTE:
       * Conservar diagnóstico del
       * calentamiento de contexto.
       */
      console.log(
        [
          "[AlertContextWarmup]",
          `scan=${this.scanNumber}`,
          `live=${result.totalLive}`,
          `analyzed=${result.analyzed}`,
          `refreshed=${result.refreshed}`,
          `pending=${result.pending}`,
          `duration=${Date.now() - startedAt}ms`,
        ].join(" ")
      );

    } catch (error) {

      console.error(
        "[AlertContextWarmup] scan failed",
        error
      );

    } finally {
      this.running = false;
    }
  }
}
