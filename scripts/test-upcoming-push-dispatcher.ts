
import "dotenv/config";

import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import type {
  PushNotificationSender,
} from "../src/modules/notifications/application/ports/PushNotificationSender";

import type {
  DueUpcomingReminder,
} from "../src/modules/notifications/application/services/GetDueUpcomingReminders";

import {
  ClaimUpcomingReminderDelivery,
} from "../src/modules/notifications/application/services/ClaimUpcomingReminderDelivery";

import {
  DispatchUpcomingReminders,
} from "../src/modules/notifications/application/services/DispatchUpcomingReminders";

import {
  UpcomingReminderDeliveryModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderDeliveryModel";

async function main() {

  const id = randomUUID();

  const matchKey =
    `test-dispatch:${id}`;

  const tokenA =
    `ExponentPushToken[TEST-A-${id}]`;

  const tokenB =
    `ExponentPushToken[TEST-B-${id}]`;

  const nowMs = Date.now();

  const dueAt =
    new Date(nowMs - 60_000);

  const kickoffAt =
    new Date(
      nowMs + 59 * 60_000
    );

  /*
   * Partido ficticio situado
   * dentro de la ventana 60m.
   */
  const reminder: DueUpcomingReminder = {
    matchKey,
    window: "60m",

    title:
      "Prueba de Football Radar",

    body:
      "Encuentro ficticio con ventaja de 15 puntos.",

    homeName:
      "Equipo A",

    awayName:
      "Equipo B",

    dueAt,
    kickoffAt,

    pointsGap: 15,
    positionGap: 9,
    dataQuality: 90,
  };

  const dueReader = {
    async execute() {
      return {
        ready: [reminder],
      };
    },
  };

  const enabledPreferences = {
    async execute() {
      return {
        enabled: true,
      };
    },
  };

  const disabledPreferences = {
    async execute() {
      return {
        enabled: false,
      };
    },
  };

  const devices = {
    async findActive() {
      return [
        {
          expoPushToken: tokenA,
        },
        {
          expoPushToken: tokenB,
        },
      ];
    },
  };

  /*
   * Solo A consintió recibir
   * próximos partidos.
   *
   * B debe quedar excluido.
   */
  const optIns = {
    async getEnabledTokens(
      tokens: readonly string[]
    ) {
      return new Set(
        tokens.filter(
          token => token === tokenA
        )
      );
    },
  };

  let fakeSendCount = 0;

  /*
   * Nunca se conecta a Internet.
   * Nunca llama a Expo.
   */
  const fakeSender:
    Pick<
      PushNotificationSender,
      "send"
    > = {

    async send(messages) {

      fakeSendCount +=
        messages.length;

      return messages.map(
        message => ({
          token: message.to,
          status: "ok" as const,
          receiptId:
            `FAKE-${id}`,
        })
      );
    },
  };

  await connectDatabase();

  try {

    await UpcomingReminderDeliveryModel.init();

    const claims =
      new ClaimUpcomingReminderDelivery();

    const previewDispatcher =
      new DispatchUpcomingReminders(
        dueReader,
        enabledPreferences,
        devices,
        optIns,
        claims,
        fakeSender,
        false
      );

    console.log(
      "\n===== PREVIEW ====="
    );

    const preview =
      await previewDispatcher.execute();

    console.log(preview);

    assert.equal(
      preview.activeDevices,
      2
    );

    assert.equal(
      preview.optedInDevices,
      1
    );

    assert.equal(
      preview.eligibleDeliveries,
      1
    );

    assert.equal(
      fakeSendCount,
      0
    );

    /*
     * Ni siquiera solicitar send
     * puede superar el bloqueo
     * explícito del despachador.
     */
    const locked =
      await previewDispatcher.execute({
        send: true,
      });

    assert.equal(
      locked.deliveryEnabled,
      false
    );

    assert.equal(
      fakeSendCount,
      0
    );

    console.log(
      "\nOK: envío bloqueado por configuración"
    );

    /*
     * Verificar el interruptor
     * global de notificaciones.
     */
    const globalBlocked =
      new DispatchUpcomingReminders(
        dueReader,
        disabledPreferences,
        devices,
        optIns,
        claims,
        fakeSender,
        true
      );

    const blocked =
      await globalBlocked.execute({
        send: true,
      });

    assert.equal(
      blocked.deliveryEnabled,
      false
    );

    assert.equal(
      fakeSendCount,
      0
    );

    console.log(
      "OK: preferencia global respetada"
    );

    /*
     * Solo para esta prueba:
     * autorizamos el sender FICTICIO.
     */
    const fakeLiveDispatcher =
      new DispatchUpcomingReminders(
        dueReader,
        enabledPreferences,
        devices,
        optIns,
        claims,
        fakeSender,
        true
      );

    console.log(
      "\n===== DOS DESPACHOS SIMULTÁNEOS ====="
    );

    const [first, second] =
      await Promise.all([
        fakeLiveDispatcher.execute({
          send: true,
        }),

        fakeLiveDispatcher.execute({
          send: true,
        }),
      ]);

    console.log({
      totalClaims:
        first.claimed +
        second.claimed,

      duplicates:
        first.duplicates +
        second.duplicates,

      fakeMessages:
        fakeSendCount,
    });

    assert.equal(
      first.claimed +
      second.claimed,
      1
    );

    assert.equal(
      fakeSendCount,
      1
    );

    /*
     * Ejecutar otra vez no debe
     * enviar un segundo mensaje.
     */
    const repeated =
      await fakeLiveDispatcher.execute({
        send: true,
      });

    assert.equal(
      repeated.claimed,
      0
    );

    assert.equal(
      fakeSendCount,
      1
    );

    /*
     * MongoDB debe tener una
     * reserva aceptada.
     *
     * El dispositivo B nunca
     * debe recibir una reserva.
     */
    const records =
      await UpcomingReminderDeliveryModel
        .find({ matchKey })
        .lean()
        .exec();

    assert.equal(
      records.length,
      1
    );

    assert.equal(
      records[0].status,
      "accepted"
    );

    console.log(
      "\nOK: un único envío ficticio"
    );

    console.log(
      "OK: sin duplicados simultáneos"
    );

    console.log(
      "OK: dispositivo sin consentimiento excluido"
    );

    console.log(
      "OK: MongoDB guarda la reserva"
    );

    console.log(
      "OK: ninguna llamada real a Expo"
    );

  } finally {

    /*
     * Eliminar solamente los
     * documentos de esta prueba.
     */
    await UpcomingReminderDeliveryModel
      .deleteMany({ matchKey });

    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[UpcomingPushDispatcherTest]",
    error
  );

  process.exitCode = 1;
});

