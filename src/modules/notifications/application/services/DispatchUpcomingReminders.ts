
import type {
  PushNotificationSender,
} from "../ports/PushNotificationSender";

import type {
  DueUpcomingReminder,
} from "./GetDueUpcomingReminders";

import type {
  ClaimUpcomingReminderDelivery,
} from "./ClaimUpcomingReminderDelivery";

import {
  compareUpcomingReminders,
} from "./RankUpcomingReminders";

/*
 * ========================================
 * LECTOR DE RECORDATORIOS
 * ========================================
 */

interface DueReader {
  execute(now?: Date): Promise<{
    ready: DueUpcomingReminder[];
  }>;
}

/*
 * ========================================
 * DESTINATARIOS MULTIUSUARIO
 * ========================================
 *
 * El lector consulta MongoDB y comprueba:
 *
 * - Dispositivos activos
 * - Propietario de cada dispositivo
 * - Preferencia general del usuario
 * - Consentimiento de próximos partidos
 *
 * Aquí nunca confiamos en un ownerId
 * recibido desde el cliente.
 */

interface RecipientReader {
  execute(): Promise<{
    globalEnabled: boolean;
    activeDevices: number;
    optedInDevices: number;
    tokens: string[];

    ownerRecipients: Array<{
      ownerId: string;
      tokens: string[];
    }>;
  }>;
}
interface DailyLimitReader {
  tryReserve(
    ownerId: string,
    matchKey: string,
    window: "24h" | "60m"
  ): Promise<boolean>;
}

/*
 * ========================================
 * RESERVAS PERSISTENTES
 * ========================================
 *
 * Una reserva por:
 *
 * - Partido
 * - Ventana del recordatorio
 * - Token del dispositivo
 */

type ClaimService =
  Pick<
    ClaimUpcomingReminderDelivery,
    "claim" | "complete"
  >;

/*
 * ========================================
 * INFORME DEL DESPACHADOR
 * ========================================
 */

export interface UpcomingDispatchResult {
  globalEnabled: boolean;
  deliveryEnabled: boolean;

  due: number;
  activeDevices: number;
  optedInDevices: number;
  eligibleDeliveries: number;

  claimed: number;
  duplicates: number;

  accepted: number;
  rejected: number;
  unknown: number;
}

/*
 * ========================================
 * DESPACHADOR
 * ========================================
 */

export class DispatchUpcomingReminders {

  constructor(
    private readonly dueReader:
      DueReader,

    private readonly recipientReader:
      RecipientReader,

    private readonly claims:
      ClaimService,

    private readonly sender:
      Pick<PushNotificationSender, "send">,

private readonly allowRealSending = false,

private readonly dailyLimit?:
  DailyLimitReader
  ) {}

  public async execute(
    options: {
      send?: boolean;
      now?: Date;
    } = {}
  ): Promise<UpcomingDispatchResult> {

    /*
     * ========================================
     * 1. VALIDACIÓN TEMPORAL
     * ========================================
     *
     * No permitir fechas simuladas
     * durante envíos reales.
     */

    if (
      options.send === true &&
      options.now
    ) {
      throw new Error(
        "Cannot simulate time during real delivery"
      );
    }

    const now =
      options.now ?? new Date();

    const nowMs =
      now.getTime();

    if (!Number.isFinite(nowMs)) {
      throw new Error(
        "Invalid date"
      );
    }

    /*
     * ========================================
     * 2. CONSULTAR RECORDATORIOS
     * ========================================
     */

    const dueResult =
      await this.dueReader.execute(now);

    /*
     * Verificación adicional:
     *
     * - Hora de aviso alcanzada
     * - Ventana todavía válida
     * - Partido todavía no iniciado
     * - Calidad suficiente
     */

    const ready =
      dueResult.ready.filter(
        reminder => {

          const dueMs =
            reminder.dueAt.getTime();

          const kickoffMs =
            reminder.kickoffAt.getTime();

          const maxLate =
            reminder.window === "24h"
              ? 60 * 60 * 1000
              : 10 * 60 * 1000;

          return (
            Number.isFinite(dueMs) &&
            Number.isFinite(kickoffMs) &&
            nowMs >= dueMs &&
            nowMs <= dueMs + maxLate &&
            kickoffMs > nowMs &&
            reminder.dataQuality >= 70
          );
        }
		  ).sort(compareUpcomingReminders);

    /*
     * ========================================
     * 3. DESTINATARIOS MULTIUSUARIO
     * ========================================
     *
     * No usamos findActive() global
     * para enviar indiscriminadamente.
     *
     * El lector ya comprobó permisos
     * individuales en MongoDB.
     */

    const selection =
      await this.recipientReader.execute();

	/*
 * Relacionamos cada token autorizado
 * con su propietario.
 *
 * No se utiliza ningún ID fijo.
 */
const ownerByToken =
  new Map<string, string>();

for (
  const group of
    selection.ownerRecipients ?? []
) {
  for (const token of group.tokens) {
    ownerByToken.set(
      token,
      group.ownerId
    );
  }
}

    /*
     * Defensa adicional:
     * evitar tokens vacíos o repetidos.
     */

    const recipients = [
      ...new Set(
        selection.tokens
          .map(token => token.trim())
          .filter(Boolean)
      ),
    ];

    /*
     * ========================================
     * 4. AUTORIZACIÓN DE ENVÍO
     * ========================================
     *
     * Deben cumplirse todas:
     *
     * - send: true
     * - allowRealSending: true
     * - Preferencia general habilitada
     * - Al menos un dispositivo autorizado
     */

const deliveryEnabled =
  options.send === true &&
  this.allowRealSending &&
  selection.globalEnabled &&
  this.dailyLimit !== undefined;

    /*
     * ========================================
     * 5. INFORME
     * ========================================
     */

    const report: UpcomingDispatchResult = {
      globalEnabled:
        selection.globalEnabled,

      deliveryEnabled,

      due:
        ready.length,

      activeDevices:
        selection.activeDevices,

      optedInDevices:
        recipients.length,

      eligibleDeliveries:
        ready.length * recipients.length,

      claimed: 0,
      duplicates: 0,

      accepted: 0,
      rejected: 0,
      unknown: 0,
    };

    /*
     * ========================================
     * 6. MODO PREVIEW
     * ========================================
     *
     * No reserva entregas.
     * No modifica MongoDB.
     * No llama a Expo.
     */

    if (!deliveryEnabled) {
      return report;
    }

    /*
     * ========================================
     * 7. PROCESAR RECORDATORIOS
     * ========================================
     */

    for (const reminder of ready) {

      const kickoffMs =
        reminder.kickoffAt.getTime();

      const expiresAt =
        new Date(
          kickoffMs +
          48 * 60 * 60 * 1000
        );

      /*
       * Enviar individualmente
       * a cada token autorizado.
       */

      for (const token of recipients) {

        /*
         * ========================================
         * 8. REVALIDAR LA HORA
         * ========================================
         *
         * Un recordatorio puede caducar
         * mientras procesamos el lote.
         */

        const currentMs =
          Date.now();

        const maxLate =
          reminder.window === "24h"
            ? 60 * 60 * 1000
            : 10 * 60 * 1000;

        if (
          currentMs >= kickoffMs ||
          currentMs >
            reminder.dueAt.getTime() +
            maxLate
        ) {
          continue;
        }

        /*
         * ========================================
         * 9. RESERVA ATÓMICA
         * ========================================
         *
         * Evita enviar repetidamente
         * el mismo recordatorio
         * al mismo token.
         */

		/*
 * LÍMITE DIARIO POR CUENTA
 *
 * Se ejecuta después de comprobar
 * que el aviso sigue dentro de
 * su ventana válida.
 */
const ownerId =
  ownerByToken.get(token);

if (!ownerId || !this.dailyLimit) {
  continue;
}

const withinDailyLimit =
  await this.dailyLimit.tryReserve(
    ownerId,
    reminder.matchKey,
    reminder.window
  );

if (!withinDailyLimit) {
  /*
   * El usuario agotó su límite.
   * No llamamos a Expo.
   * No creamos reserva de entrega.
   */
  continue;
}

        const acquired =
          await this.claims.claim({
            matchKey:
              reminder.matchKey,

            window:
              reminder.window,

            expoPushToken:
              token,

            expiresAt,
          });

        if (!acquired) {
          report.duplicates++;
          continue;
        }

        report.claimed++;

        /*
         * ========================================
         * 10. ESTADO DE LA ENTREGA
         * ========================================
         */

        let status:
          "accepted" |
          "rejected" |
          "unknown" = "unknown";

        let expoTicketId:
          string | null = null;

        let errorCode:
          string | null = null;

        /*
         * ========================================
         * 11. ENVIAR A EXPO
         * ========================================
         */

        try {

          const results =
            await this.sender.send([
              {
                to: token,

                title:
                  reminder.title,

                body:
                  reminder.body,

                sound:
                  "default",

                channelId:
                  "radar-alerts",

                data: {
                  type:
                    "OPEN_ALERTS",

                  source:
                    "upcoming",

                  matchKey:
                    reminder.matchKey,

                  window:
                    reminder.window,
                },
              },
            ]);

          const result =
            results[0];

          /*
           * Expo aceptó inicialmente
           * el mensaje.
           *
           * El ticket no confirma
           * que Android lo recibió.
           */

          if (
            result?.status === "ok" &&
            result.receiptId
          ) {

            status = "accepted";

            expoTicketId =
              result.receiptId;

          } else if (
            result?.status === "error" &&
            result.errorCode
          ) {

            status = "rejected";

            errorCode =
              result.errorCode;
          }

          /*
           * Si Expo no devuelve
           * una respuesta concluyente,
           * conservar estado unknown.
           */

        } catch (error) {

          console.error(
            "[UpcomingDispatch] transport error",
            reminder.matchKey,
            error instanceof Error
              ? error.message
              : "Unknown error"
          );

          /*
           * No sabemos si Expo recibió
           * el mensaje.
           *
           * No reenviamos automáticamente
           * para evitar duplicados.
           */

          status = "unknown";
        }

        /*
         * ========================================
         * 12. COMPLETAR RESERVA
         * ========================================
         */

        try {

          await this.claims.complete({
            matchKey:
              reminder.matchKey,

            window:
              reminder.window,

            expoPushToken:
              token,

            status,
            expoTicketId,
            errorCode,
          });

        } catch (error) {

          console.error(
            "[UpcomingDispatch] completion failed",
            reminder.matchKey,
            error instanceof Error
              ? error.message
              : "Unknown error"
          );
        }

        /*
         * ========================================
         * 13. ACTUALIZAR INFORME
         * ========================================
         */

        report[status]++;
      }
    }

    return report;
  }
}

