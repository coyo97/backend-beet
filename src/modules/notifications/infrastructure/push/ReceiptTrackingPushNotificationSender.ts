
import type {
  PushNotificationMessage,
  PushNotificationSender,
  PushSendResult,
} from "../../application/ports/PushNotificationSender";

import type {
  PushReceiptRepository,
} from "../../domain/repositories/PushReceiptRepository";

/*
 * Registra automáticamente los tickets
 * aceptados por Expo.
 *
 * No reenvía notificaciones.
 * No modifica límites ni consentimientos.
 */
export class ReceiptTrackingPushNotificationSender
  implements PushNotificationSender
{
  constructor(
    private readonly transport:
      PushNotificationSender,

    private readonly receipts:
      Pick<
        PushReceiptRepository,
        "createPending"
      >
  ) {}

  public async send(
    messages: PushNotificationMessage[]
  ): Promise<PushSendResult[]> {

    /*
     * El emisor real sigue siendo
     * ExpoPushNotificationSender.
     */
    const results =
      await this.transport.send(messages);

	console.log(
  "[PushReceiptTracking] EXPO",
  {
    messages: messages.length,
    results: results.length,

    accepted: results.filter(
      item => item.status === "ok"
    ).length,

    withTicket: results.filter(
      item =>
        item.status === "ok" &&
        Boolean(item.receiptId)
    ).length,

    rejected: results.filter(
      item => item.status === "error"
    ).length,
  }
);

    const sentAt = new Date();

    /*
     * Consultar los recibos después
     * de cinco minutos.
     */
    const nextCheckAt =
      new Date(
        sentAt.getTime() + 5 * 60_000
      );

    for (
      let index = 0;
      index < messages.length;
      index++
    ) {
      const message = messages[index];
      const result = results[index];

      if (
        !message ||
        result?.status !== "ok" ||
        !result.receiptId
      ) {
        continue;
      }

      try {
        await this.receipts.createPending({
          receiptId:
            result.receiptId,

          expoPushToken:
            message.to,

          sentAt,
          nextCheckAt,
        });

		console.log(
  "[PushReceiptTracking] SAVED",
  {
    status: "pending",
    sentAt: sentAt.toISOString(),
  }
);

      } catch (error) {
        /*
         * El envío ya ocurrió.
         *
         * No repetirlo si falla
         * el registro del recibo.
         */
        console.error(
          "[PushReceiptTracking] registration failed",
          error instanceof Error
            ? error.message
            : "Unknown error"
        );
      }
    }

    return results;
  }
}

