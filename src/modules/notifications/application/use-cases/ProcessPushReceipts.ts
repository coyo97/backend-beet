import type {
  PushReceiptClient,
} from "../ports/PushReceiptClient";

import type {
  PushDeviceRepository,
} from "../../domain/repositories/PushDeviceRepository";

import type {
  PushReceiptRepository,
} from "../../domain/repositories/PushReceiptRepository";

export interface ProcessPushReceiptsResult {
  scanned:
    number;

  delivered:
    number;

  errors:
    number;

  pending:
    number;

  expired:
    number;

  devicesDeactivated:
    number;
}

export class ProcessPushReceipts {
  private readonly maxAgeMs =
    24 *
    60 *
    60 *
    1000;

  private readonly retryMs =
    5 *
    60 *
    1000;

  constructor(
    private readonly receiptRepository:
      PushReceiptRepository,

    private readonly deviceRepository:
      PushDeviceRepository,

    private readonly receiptClient:
      PushReceiptClient
  ) {}

  public async execute():
    Promise<
      ProcessPushReceiptsResult
    > {

    const now =
      new Date();

    const records =
      await this
        .receiptRepository
        .findReady(
          now,
          1000
        );

    const summary:
      ProcessPushReceiptsResult = {
        scanned:
          records.length,

        delivered:
          0,

        errors:
          0,

        pending:
          0,

        expired:
          0,

        devicesDeactivated:
          0,
      };

    if (
      records.length ===
      0
    ) {
      return summary;
    }

    const remoteReceipts =
      await this
        .receiptClient
        .getReceipts(
          records.map(
            (
              record
            ) =>
              record.receiptId
          )
        );

    for (
      const record
      of records
    ) {
      const remote =
        remoteReceipts.get(
          record.receiptId
        );

      if (!remote) {
        const age =
          now.getTime() -
          record.sentAt
            .getTime();

        if (
          age >=
          this.maxAgeMs
        ) {
          await this
            .receiptRepository
            .markExpired(
              record.receiptId,
              now
            );

          summary.expired +=
            1;

          continue;
        }

        const nextCheckAt =
          new Date(
            now.getTime() +
              this.retryMs
          );

        await this
          .receiptRepository
          .reschedule(
            record.receiptId,
            nextCheckAt,
            now
          );

        summary.pending +=
          1;

        continue;
      }

      if (
        remote.status ===
        "ok"
      ) {
        await this
          .receiptRepository
          .markDelivered(
            record.receiptId,
            now
          );

        summary.delivered +=
          1;

        continue;
      }

      await this
        .receiptRepository
        .markError(
          record.receiptId,
          remote.errorCode,
          remote.message,
          now
        );

      summary.errors +=
        1;

      if (
        remote.errorCode ===
        "DeviceNotRegistered"
      ) {
        await this
          .deviceRepository
          .deactivate(
            record.expoPushToken
          );

        summary.devicesDeactivated +=
          1;
      }

      if (
        remote.errorCode ===
          "MismatchSenderId" ||
        remote.errorCode ===
          "InvalidCredentials"
      ) {
        console.error(
          "[PushReceipt] FCM configuration error",
          {
            errorCode:
              remote.errorCode,

            message:
              remote.message,
          }
        );
      }
    }

    return summary;
  }
}
