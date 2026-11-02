
import type {
  GetLiveOpportunities,
} from "../../../opportunity-filter/application/use-cases/GetLiveOpportunities";

export class AlertContextWarmupScheduler {

  private interval:
    NodeJS.Timeout | null = null;

  private initialTimer:
    NodeJS.Timeout | null = null;

  private running = false;

  private scanNumber = 0;

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
       * Reutilizamos la misma
       * instancia que usa el módulo
       * de oportunidades.
       *
       * El presupuesto global de
       * contextos continúa vigente.
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

          /*
           * No iniciar seguimientos
           * de eventos adicionales.
           */
		  skipEventTracking: true,

skipLateGoalAnalysis: true,
        });

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

