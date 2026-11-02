
import type {
  PlanUpcomingReminders,
} from "../../application/services/PlanUpcomingReminders";

import type {
  GetDueUpcomingReminders,
} from "../../application/services/GetDueUpcomingReminders";

import type {
  DispatchUpcomingReminders,
} from "../../application/services/DispatchUpcomingReminders";

export class UpcomingReminderScheduler {

  private timer: NodeJS.Timeout | null =
    null;

  private initialTimer:
    NodeJS.Timeout | null = null;

  private running = false;

  private scanNumber = 0;

  /*
   * Revisar MongoDB cada minuto.
   *
   * Sin consultas adicionales
   * a Flashscore.
   */
  private readonly intervalMs =
    60 * 1000;

  constructor(
    private readonly planner:
      PlanUpcomingReminders,

    private readonly dueReader:
      GetDueUpcomingReminders,

    private readonly dispatcher:
      DispatchUpcomingReminders
  ) {}

  public start(): void {

    if (
      process.env
        .UPCOMING_REMINDER_SCAN_ENABLED !==
      "true"
    ) {

      console.log(
        "[UpcomingReminderScheduler] disabled"
      );

      return;
    }

    if (
      this.timer ||
      this.initialTimer
    ) {
      return;
    }

    console.log(
      "[UpcomingReminderScheduler] started",
      `interval=${this.intervalMs}ms`,
	  `mode=${
  process.env.UPCOMING_REMINDER_SEND_ENABLED === "true"
    ? "send"
    : "preview"
}`
    );

    /*
     * Separar el arranque
     * del escaneo mundial.
     */
    this.initialTimer =
      setTimeout(() => {

        this.initialTimer = null;

        void this.runOnce().catch(
          () => undefined
        );

      }, 15_000);

    this.timer =
      setInterval(() => {

        void this.runOnce().catch(
          () => undefined
        );

      }, this.intervalMs);
  }

  public stop(): void {

    if (this.initialTimer) {

      clearTimeout(
        this.initialTimer
      );

      this.initialTimer = null;
    }

    if (this.timer) {

      clearInterval(
        this.timer
      );

      this.timer = null;
    }

    console.log(
      "[UpcomingReminderScheduler] stopped"
    );
  }

  public async runOnce():
    Promise<void> {

    if (this.running) {

      console.warn(
        "[UpcomingReminderScheduler] previous scan running"
      );

      return;
    }

    this.running = true;

    this.scanNumber++;

    const startedAt =
      Date.now();

    try {

      /*
       * 1. Sincronizar recordatorios.
       *
       * Lee oportunidades
       * confirmadas en MongoDB.
       */
      const plan =
        await this.planner.execute();

      /*
       * 2. Consultar avisos
       * cuyo horario ha llegado.
       */
      const due =
        await this.dueReader.execute();

      /*
       * 3. Vista previa del envío.
       *
       * Comprueba:
       *
       * - preferencia global
       * - dispositivos activos
       * - consentimiento específico
       * - recordatorios vigentes
       *
       * NO solicita reservas.
       * NO contacta con Expo.
       */
/*
 * Envío automático controlado.
 *
 * Apagado por defecto.
 * Respeta los dispositivos autorizados,
 * la preferencia general y los opt-ins.
 */
const sendRequested =
  process.env.UPCOMING_REMINDER_SEND_ENABLED ===
  "true";

const delivery =
  await this.dispatcher.execute({
    send: sendRequested,
  });

/*
 * Si estamos en preview, jamás
 * se deben habilitar entregas reales.
 */
if (
  !sendRequested &&
  delivery.deliveryEnabled
) {
  throw new Error(
    "Unexpected real delivery in preview mode"
  );
}


      console.log(
        [
          "[UpcomingReminderScheduler]",
          `scan=${this.scanNumber}`,
          `opportunities=${plan.opportunitiesRead}`,
          `created=${plan.created}`,
          `existing=${plan.existing}`,
          `due=${due.scanned}`,
          `ready=${due.ready.length}`,
          `late=${due.expiredWindow}`,
          `invalid=${due.invalidOpportunity}`,
          `stale=${due.staleContext}`,
`sendEnabled=${delivery.deliveryEnabled}`,
`pushEnabled=${delivery.globalEnabled}`,
`devices=${delivery.activeDevices}`,
`optedIn=${delivery.optedInDevices}`,
`eligibleDeliveries=${delivery.eligibleDeliveries}`,
`claimed=${delivery.claimed}`,
`duplicates=${delivery.duplicates}`,
`accepted=${delivery.accepted}`,
`rejected=${delivery.rejected}`,
`unknown=${delivery.unknown}`,        ].join(" ")
      );

      /*
       * Mostrar únicamente
       * recordatorios válidos.
       *
       * No registrar tokens
       * de dispositivos.
       */
      for (const reminder of due.ready) {

        console.log(
          "[UpcomingReminderScheduler] READY",
          {
            matchKey:
              reminder.matchKey,

            window:
              reminder.window,

            title:
              reminder.title,

            pointsGap:
              reminder.pointsGap,

            kickoffAt:
              reminder.kickoffAt
                .toISOString(),
          }
        );
      }

    } catch (error) {

      console.error(
        "[UpcomingReminderScheduler] failed",
        error
      );

      throw error;

    } finally {

      this.running = false;
    }
  }
}

