
import "dotenv/config";

import assert from "node:assert/strict";

import {
  randomUUID,
} from "node:crypto";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  ClaimUpcomingReminderDelivery,
} from "../src/modules/notifications/application/services/ClaimUpcomingReminderDelivery";

import {
  UpcomingReminderDeliveryModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderDeliveryModel";

import {
  getDueUpcomingReminders,
} from "../src/modules/notifications/upcomingReminderModule";

import {
  getPushPreferences,
  pushDeviceRepository,
} from "../src/modules/notifications/notificationModule";

async function main() {

  /*
   * Datos completamente ficticios.
   *
   * No utilizamos partidos ni
   * tokens reales para las reservas.
   */
  const matchKey =
    `test-upcoming:${randomUUID()}`;

  const tokenA =
    "ExponentPushToken[TEST-RADAR-A]";

  const tokenB =
    "ExponentPushToken[TEST-RADAR-B]";

  await connectDatabase();

  try {

    await UpcomingReminderDeliveryModel
      .init();

    const service =
      new ClaimUpcomingReminderDelivery();

    const input = {
      matchKey,
      window: "60m" as const,

      expoPushToken:
        tokenA,

      expiresAt:
        new Date(
          Date.now() +
          48 * 60 * 60 * 1000
        ),
    };

    console.log(
      "\n===== OCHO RESERVAS SIMULTÁNEAS ====="
    );

    const results =
      await Promise.all(
        Array.from(
          { length: 8 },
          () => service.claim(input)
        )
      );

    const acquired =
      results.filter(Boolean).length;

    console.log({
      attempts: results.length,
      acquired,
      duplicatesPrevented:
        results.length - acquired,
    });

    assert.equal(
      acquired,
      1,
      "Only one reservation must succeed"
    );

    /*
     * Un segundo dispositivo
     * sí tiene derecho a su
     * propio intento.
     */
    const secondDevice =
      await service.claim({
        ...input,

        expoPushToken:
          tokenB,
      });

    assert.equal(
      secondDevice,
      true
    );

    const records =
      await UpcomingReminderDeliveryModel
        .find({ matchKey })
        .lean()
        .exec();

    assert.equal(
      records.length,
      2
    );

    /*
     * Simulamos una respuesta.
     *
     * No llamamos a Expo.
     * No es una entrega real.
     */
    const completed =
      await service.complete({
        matchKey,
        window: "60m",

        expoPushToken:
          tokenA,

        status:
          "accepted",

        expoTicketId:
          "TEST-TICKET-LOCAL",
      });

    assert.equal(
      completed,
      true
    );

    /*
     * Completar por segunda vez
     * no debe modificar nada.
     */
    const completedAgain =
      await service.complete({
        matchKey,
        window: "60m",

        expoPushToken:
          tokenA,

        status:
          "accepted",
      });

    assert.equal(
      completedAgain,
      false
    );

    /*
     * Tampoco debe concederse
     * otra reserva al primer
     * dispositivo.
     */
    const duplicate =
      await service.claim(input);

    assert.equal(
      duplicate,
      false
    );

    console.log(
      "\nOK: una reserva por dispositivo"
    );

    console.log(
      "OK: concurrencia protegida"
    );

    console.log(
      "OK: estado completado una sola vez"
    );

    /*
     * VISTA PREVIA REAL
     *
     * Leer los dispositivos activos
     * y las preferencias existentes.
     *
     * No almacenar reservas reales.
     * No enviar notificaciones.
     */
    console.log(
      "\n===== VISTA PREVIA DE ENVÍOS ====="
    );

    const preferences =
      await getPushPreferences.execute();

    const devices =
      await pushDeviceRepository
        .findActive();

    const due =
      await getDueUpcomingReminders
        .execute();

    console.log({
      pushGloballyEnabled:
        preferences.enabled,

      activeDevices:
        devices.length,

      dueNow:
        due.ready.length,

      potentialDeliveries:
        preferences.enabled
          ? due.ready.length *
            devices.length
          : 0,
    });

    console.table(
      due.ready.map(
        reminder => ({
          match:
            `${reminder.homeName} vs ${reminder.awayName}`,

          window:
            reminder.window,

          pointsGap:
            reminder.pointsGap,

          candidateDevices:
            preferences.enabled
              ? devices.length
              : 0,
        })
      )
    );

    console.log(
      "\nOK: vista previa sin envíos reales"
    );

  } finally {

    /*
     * Limpiar solamente los
     * documentos ficticios
     * creados por esta prueba.
     */
    await UpcomingReminderDeliveryModel
      .deleteMany({ matchKey });

    await disconnectDatabase();
  }
}

void main().catch(error => {

  console.error(
    "[UpcomingDeliveryClaimsTest]",
    error
  );

  process.exitCode = 1;
});

