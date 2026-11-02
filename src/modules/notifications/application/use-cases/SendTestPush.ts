
import type {
  PushNotificationSender,
} from "../ports/PushNotificationSender";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

export class SendTestPush {
  constructor(
    private readonly devices:
      PushDeviceRepository,

    private readonly sender:
      PushNotificationSender
  ) {}

  public async execute(
    ownerId: string
  ) {

    /*
     * Solo los dispositivos
     * del usuario autenticado.
     */
    const devices =
      await this.devices
        .findActiveByOwner(
          ownerId
        );

    if (
      devices.length === 0
    ) {
      return {
        devices: 0,
        results: [],
      };
    }

    const results =
      await this.sender.send(
        devices.map(
          device => ({
            to:
              device.expoPushToken,

            title:
              "⚽ Football Radar",

            body:
              "Push remoto funcionando correctamente.",

            sound:
              "default",

            channelId:
              "radar-alerts",

            data: {
              type:
                "OPEN_ALERTS",

              test:
                true,
            },
          })
        )
      );

    return {
      devices:
        devices.length,

      results,
    };
  }
}

