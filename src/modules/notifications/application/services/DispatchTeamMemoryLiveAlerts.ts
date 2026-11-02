
import type {
  OwnerTeamMemoryLiveAlert,
} from "./FindTeamMemoryLiveAlerts";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

import {
  rankTeamMemoryLiveAlerts,
} from "./RankTeamMemoryLiveAlerts";

import type {
  PushNotificationSender,
} from "../ports/PushNotificationSender";

import {
  MongooseTeamMemoryLiveOptInRepository,
} from "../../infrastructure/repositories/MongooseTeamMemoryLiveOptInRepository";

import {
  ClaimTeamMemoryLiveDelivery,
} from "./ClaimTeamMemoryLiveDelivery";

interface GlobalPreferencesReader {
  get(ownerId: string): Promise<{
    enabled: boolean;
  }>;
}

export interface TeamMemoryVolumeLimiter {
  tryReserve(
    ownerId: string,
    matchKey: string
  ): Promise<boolean>;
}

export interface TeamMemoryDispatchReport {
  alerts: number;
  globalDisabled: number;
  activeDevices: number;
  optedInDevices: number;
  eligible: number;
  claimed: number;
  duplicates: number;
  attempted: number;
  accepted: number;
  rejected: number;
  unknown: number;
  volumeBlocked: number;
}

export class DispatchTeamMemoryLiveAlerts {

  constructor(
    private readonly devices:
      PushDeviceRepository,

    private readonly preferences:
      GlobalPreferencesReader,

    private readonly optIns:
      MongooseTeamMemoryLiveOptInRepository,

    private readonly claims:
      ClaimTeamMemoryLiveDelivery,

    private readonly sender:
      PushNotificationSender,

    /*
     * Bloqueo adicional.
     *
     * Por defecto, incluso con
     * execute({ send: true }),
     * NO se envían mensajes.
     *
     * Solo una prueba controlada
     * puede utilizar true junto
     * con un emisor falso.
     */
private readonly allowSending = false,

/*
 * Obligatorio para los envíos reales.
 * Si no está configurado, no se permite
 * contactar a Expo.
 */
private readonly volumeLimiter:
  TeamMemoryVolumeLimiter | null = null
) {}

  public async execute(
    alerts: readonly OwnerTeamMemoryLiveAlert[],
    options: {
      send?: boolean;
    } = {}
  ): Promise<TeamMemoryDispatchReport> {

    const report: TeamMemoryDispatchReport = {
      alerts: alerts.length,
      globalDisabled: 0,
      activeDevices: 0,
      optedInDevices: 0,
      eligible: 0,
      claimed: 0,
      duplicates: 0,
      attempted: 0,
      accepted: 0,
      rejected: 0,
      unknown: 0,
	  volumeBlocked: 0,
    };

    const realSend =
      options.send === true &&
      this.allowSending;

	/*
 * Fallar de forma segura.
 *
 * Nunca permitir envíos reales
 * sin protección de volumen.
 */
if (
  realSend &&
  !this.volumeLimiter
) {
  throw new Error(
    "Team Memory volume limiter not configured"
  );
}

/*
 * Ordenar antes de procesar reservas
 * y aplicar pausas por propietario.
 */
for (
  const alert of rankTeamMemoryLiveAlerts(
    alerts
  )
) {

      /*
       * Nunca enviar una alerta
       * sin propietario o identidad
       * de partido.
       */
      if (
        !alert.ownerId ||
        !alert.matchKey
      ) {
        continue;
      }

      /*
       * Respetar preferencias
       * generales del propietario.
       */
      const preferences =
        await this.preferences.get(
          alert.ownerId
        );

      if (!preferences.enabled) {
        report.globalDisabled++;
        continue;
      }

      /*
       * No utilizar findActive()
       * global: solo dispositivos
       * de este propietario.
       */
      const devices =
        await this.devices.findActiveByOwner(
          alert.ownerId
        );

      report.activeDevices +=
        devices.length;

      if (devices.length === 0) {
        continue;
      }

      /*
       * Consentimiento específico
       * de Team Memory.
       */
      const enabledTokens =
        await this.optIns
          .getEnabledTokensForOwner(
            alert.ownerId,
            devices.map(
              device =>
                device.expoPushToken
            )
          );

report.optedInDevices +=
  enabledTokens.size;

/*
 * Comprobar si existe al menos
 * un teléfono autorizado.
 */
const hasAuthorizedDevice =
  devices.some(device =>
    enabledTokens.has(
      device.expoPushToken
    )
  );

/*
 * Una reserva por partido y cuenta,
 * nunca una reserva por teléfono.
 *
 * En preview no tocamos el contador.
 */
let volumeAllowed = true;

if (
  realSend &&
  hasAuthorizedDevice
) {
  if (!this.volumeLimiter) {
    throw new Error(
      "Team Memory volume limiter unavailable"
    );
  }

  volumeAllowed =
    await this.volumeLimiter.tryReserve(
      alert.ownerId,
      alert.matchKey
    );
}

for (const device of devices) {
        if (
          !enabledTokens.has(
            device.expoPushToken
          )
        ) {
          continue;
        }

        report.eligible++;

        /*
         * En preview no reservamos,
         * no modificamos entregas
         * y no llamamos a Expo.
         */
        if (!realSend) {
          continue;
        }

		/*
 * El límite o la pausa impiden
 * entregar este aviso.
 *
 * Los demás teléfonos autorizados
 * tampoco consumirán más cupos.
 */
if (!volumeAllowed) {
  report.volumeBlocked++;
  continue;
}

        const identity = {
          ownerId: alert.ownerId,
          matchKey: alert.matchKey,
          expoPushToken:
            device.expoPushToken,
        };

        const claimed =
          await this.claims.claim({
            ...identity,
            expiresAt: new Date(
              Date.now() +
              48 * 60 * 60_000
            ),
          });

        if (!claimed) {
          report.duplicates++;
          continue;
        }

        report.claimed++;
        report.attempted++;

        let status:
          "accepted" |
          "rejected" |
          "unknown" = "unknown";

        let ticketId:
          string | null = null;

        let errorCode:
          string | null = null;

        try {
          const results =
            await this.sender.send([
              {
                to:
                  device.expoPushToken,

                title:
                  alert.title,

                body:
                  alert.body,

                sound:
                  "default",

                channelId:
                  "radar-alerts",

                data: {
                  type:
                    "TEAM_MEMORY_LIVE",

                  matchKey:
                    alert.matchKey,
                },
              },
            ]);

          const result =
            results[0];

          if (result?.status === "ok") {
            status = "accepted";

            ticketId =
              result.receiptId ?? null;

          } else if (
            result?.status === "error" &&
            result.errorCode
          ) {
            status = "rejected";

            errorCode =
              result.errorCode;
          }

        } catch {
          /*
           * No sabemos si el proveedor
           * recibió el mensaje.
           *
           * No reintentamos para
           * evitar notificaciones dobles.
           */
          status = "unknown";
        }

        await this.claims.complete({
          ...identity,
          status,
          expoTicketId: ticketId,
          errorCode,
        });

        report[status]++;
      }
    }

    return report;
  }
}

