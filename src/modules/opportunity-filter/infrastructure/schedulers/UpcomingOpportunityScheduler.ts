
import type {
  UpcomingLeagueCandidateScanner,
} from "../../application/services/UpcomingLeagueCandidateScanner";

import type {
  ConfirmedUpcomingOpportunity,
  UpcomingOpportunityReviewQueue,
} from "../../application/services/UpcomingOpportunityReviewQueue";

import type {
  MongooseUpcomingOpportunityRepository,
} from "../repositories/MongooseUpcomingOpportunityRepository";

export class UpcomingOpportunityScheduler {
  private interval: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;

  private running = false;
  private scanNumber = 0;

  /*
   * Cinco ligas cada tres minutos.
   * Dos revisiones profundas por ciclo.
   */
  private readonly intervalMs =
    3 * 60 * 1000;

  private readonly maxLeagues = 5;
  private readonly maxReviews = 2;

  /*
   * Si MongoDB falla, conservamos
   * las confirmaciones temporalmente
   * para reintentar la escritura.
   */
  private readonly unsaved =
    new Map<
      string,
      ConfirmedUpcomingOpportunity
    >();

  constructor(
    private readonly scanner:
      UpcomingLeagueCandidateScanner,

    private readonly queue:
      UpcomingOpportunityReviewQueue,

    private readonly repository:
      MongooseUpcomingOpportunityRepository
  ) {}

  public start(): void {
    if (
      process.env
        .UPCOMING_OPPORTUNITY_SCAN_ENABLED !==
      "true"
    ) {
      console.log(
        "[UpcomingScheduler] disabled"
      );
      return;
    }

    if (this.interval || this.initialTimer) {
      return;
    }

    console.log(
      "[UpcomingScheduler] started",
      `interval=${this.intervalMs}ms`,
      `leagues=${this.maxLeagues}`,
      `reviews=${this.maxReviews}`
    );

    /*
     * Primera ejecución:
     * 45 segundos después del arranque,
     * evitando cargar simultáneamente
     * todos los schedulers.
     */
    this.initialTimer = setTimeout(() => {
      this.initialTimer = null;
      void this.runOnce();
    }, 45_000);

    this.interval = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log(
      "[UpcomingScheduler] stopped"
    );
  }

  /*
   * Disponible para pruebas manuales.
   * No depende del flag de arranque.
   */
  public async runOnce(): Promise<void> {
    if (this.running) {
      console.warn(
        "[UpcomingScheduler] previous scan still running"
      );
      return;
    }

    this.running = true;
    this.scanNumber++;

    const startedAt = Date.now();

    let totalUpcoming = 0;
    let scannedLeagues = 0;
    let standingsRequests = 0;
    let found = 0;
    let added = 0;

    let attempted = 0;
    let confirmed = 0;
    let saved = 0;

    try {
      /*
       * 1. Descubrir candidatos.
       *
       * El scanner conserva:
       * - su cursor
       * - su cache de tablas
       *
       * No se reconstruye
       * entre ejecuciones.
       */
      try {
        const scan =
          await this.scanner.execute({
            hours: 48,
            maxLeagues: this.maxLeagues,
          });

        totalUpcoming =
          scan.totalUpcoming;

        scannedLeagues =
          scan.scannedLeagues;

        standingsRequests =
          scan.standingsRequests;

        found =
          scan.candidates.length;

        /*
         * 2. Añadir a la cola.
         */
        added =
          this.queue.add(
            scan.candidates
          );
      } catch (error) {
        console.error(
          "[UpcomingScheduler] discovery failed",
          error
        );
      }

      /*
       * 3. Revisar pendientes.
       *
       * Aunque Flashscore falle al
       * descubrir nuevos encuentros,
       * podemos continuar revisando
       * los que ya están en cola.
       */
      try {
        const review =
          await this.queue.review(
            this.maxReviews
          );

        attempted =
          review.attempted;

        confirmed =
          review.confirmed.length;

        for (const item of review.confirmed) {
          this.unsaved.set(
            item.key,
            item
          );
        }
      } catch (error) {
        console.error(
          "[UpcomingScheduler] review failed",
          error
        );
      }

      /*
       * 4. Guardar confirmados.
       *
       * La colección tiene índice
       * único por matchKey.
       */
      for (
        const [key, item]
        of this.unsaved
      ) {
        /*
         * Un partido comenzado ya
         * no pertenece a este flujo.
         */
        const kickoff =
          Date.parse(
            item.match.kickoffAt
          );

        if (
          !Number.isFinite(kickoff) ||
          kickoff <= Date.now()
        ) {
          this.unsaved.delete(key);
          continue;
        }

        try {
          const ok =
            await this.repository.saveOne(
              item
            );

          if (ok) {
            saved++;
            this.unsaved.delete(key);
          }
        } catch (error) {
          console.error(
            "[UpcomingScheduler] persistence failed",
            key,
            error
          );

          /*
           * Mantener temporalmente
           * para el próximo ciclo.
           */
        }
      }

      console.log(
        [
          "[UpcomingScheduler]",
          `scan=${this.scanNumber}`,
          `upcoming=${totalUpcoming}`,
          `leagues=${scannedLeagues}`,
          `tableRequests=${standingsRequests}`,
          `candidates=${found}`,
          `added=${added}`,
          `reviewed=${attempted}`,
          `confirmed=${confirmed}`,
          `saved=${saved}`,
          `pending=${this.queue.size()}`,
          `unsaved=${this.unsaved.size}`,
          `duration=${Date.now() - startedAt}ms`,
        ].join(" ")
      );

    } finally {
      this.running = false;
    }
  }
}

