
import assert from "node:assert/strict";

import type {
  PushNotificationMessage,
  PushNotificationSender,
  PushSendResult,
} from "../src/modules/notifications/application/ports/PushNotificationSender";

import type {
  PushReceiptRepository,
} from "../src/modules/notifications/domain/repositories/PushReceiptRepository";

import {
  ReceiptTrackingPushNotificationSender,
} from "../src/modules/notifications/infrastructure/push/ReceiptTrackingPushNotificationSender";

type PendingInput =
  Parameters<
    PushReceiptRepository["createPending"]
  >[0];

const pending: PendingInput[] = [];

const fakeReceipts = {
  async createPending(
    input: PendingInput
  ): Promise<void> {
    pending.push(input);
  },
};

const fakeTransport: PushNotificationSender = {
  async send(
    messages: PushNotificationMessage[]
  ): Promise<PushSendResult[]> {
    return messages.map((message, index) =>
      index === 0
        ? {
            token: message.to,
            status: "ok",
            receiptId: "synthetic-receipt-001",
          }
        : {
            token: message.to,
            status: "error",
            errorCode: "DeviceNotRegistered",
          }
    );
  },
};

async function main(): Promise<void> {
  const sender =
    new ReceiptTrackingPushNotificationSender(
      fakeTransport,
      fakeReceipts
    );

  const messages: PushNotificationMessage[] = [
    {
      to: "ExponentPushToken[synthetic-a]",
      title: "Prueba A",
      body: "Aceptada",
      sound: "default",
      channelId: "radar-alerts",
      data: { test: true },
    },
    {
      to: "ExponentPushToken[synthetic-b]",
      title: "Prueba B",
      body: "Rechazada",
      sound: "default",
      channelId: "radar-alerts",
      data: { test: true },
    },
  ];

  const results =
    await sender.send(messages);

  assert.equal(results.length, 2);

  assert.equal(
    pending.length,
    1
  );

  assert.equal(
    pending[0].receiptId,
    "synthetic-receipt-001"
  );

  assert.equal(
    pending[0].expoPushToken,
    messages[0].to
  );

  assert.ok(
    pending[0].nextCheckAt.getTime() >
    pending[0].sentAt.getTime()
  );

  console.log(
    "OK: ticket aceptado registrado"
  );

  console.log(
    "OK: envío rechazado sin recibo pendiente"
  );

  console.log(
    "OK: consulta posterior programada"
  );

  console.log(
    "PUSH RECEIPT TRACKING: OK"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

