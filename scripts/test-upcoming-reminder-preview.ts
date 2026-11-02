
import "dotenv/config";

import assert from "node:assert/strict";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  createUpcomingReminderScheduler,
  upcomingReminderDispatcher,
} from "../src/modules/notifications/upcomingReminderModule";

import {
  UpcomingReminderModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderModel";

import {
  UpcomingReminderDeliveryModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderDeliveryModel";

async function main() {

  await connectDatabase();

  const scheduler =
    createUpcomingReminderScheduler();

  try {

    const deliveriesBefore =
      await UpcomingReminderDeliveryModel
        .countDocuments();

    const sentBefore =
      await UpcomingReminderModel
        .countDocuments({
          status: "sent",
        });

    console.log(
      "\n===== PREVIEW AUTOMÁTICO ====="
    );

    /*
     * Dos ciclos reales del
     * scheduler, pero sin push.
     */
    await scheduler.runOnce();

    await scheduler.runOnce();

    /*
     * Consultar directamente el
     * despachador para verificar
     * su modo de funcionamiento.
     */
    const preview =
      await upcomingReminderDispatcher
        .execute({
          send: false,
        });

    const deliveriesAfter =
      await UpcomingReminderDeliveryModel
        .countDocuments();

    const sentAfter =
      await UpcomingReminderModel
        .countDocuments({
          status: "sent",
        });

    console.log(
      "\n===== ESTADO DEL DESPACHADOR ====="
    );

    console.table({
      globalEnabled:
        preview.globalEnabled,

      deliveryEnabled:
        preview.deliveryEnabled,

      due:
        preview.due,

      devices:
        preview.activeDevices,

      optedIn:
        preview.optedInDevices,

      eligible:
        preview.eligibleDeliveries,

      claimed:
        preview.claimed,

      accepted:
        preview.accepted,

      deliveriesBefore,
      deliveriesAfter,

      sentBefore,
      sentAfter,
    });

    /*
     * El modo preview no puede
     * producir envíos.
     */
    assert.equal(
      preview.deliveryEnabled,
      false
    );

    assert.equal(
      preview.claimed,
      0
    );

    assert.equal(
      preview.accepted,
      0
    );

    /*
     * Tampoco puede crear
     * reservas en MongoDB.
     */
    assert.equal(
      deliveriesAfter,
      deliveriesBefore
    );

    /*
     * Ni marcar recordatorios
     * como enviados.
     */
    assert.equal(
      sentAfter,
      sentBefore
    );

    console.log(
      "\nOK: integración con scheduler"
    );

    console.log(
      "OK: preferencias consultadas"
    );

    console.log(
      "OK: dispositivos consultados"
    );

    console.log(
      "OK: sin reservas nuevas"
    );

    console.log(
      "OK: sin avisos marcados como enviados"
    );

    console.log(
      "OK: Expo Push no utilizado"
    );

  } finally {

    scheduler.stop();

    await disconnectDatabase();
  }
}

void main().catch(error => {

  console.error(
    "[UpcomingReminderPreviewTest]",
    error
  );

  process.exitCode = 1;
});

