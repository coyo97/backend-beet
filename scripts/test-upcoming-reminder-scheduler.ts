
import "dotenv/config";

import assert from "node:assert/strict";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  createUpcomingReminderScheduler,
  getDueUpcomingReminders,
} from "../src/modules/notifications/upcomingReminderModule";

import {
  UpcomingReminderModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderModel";

async function main() {

  await connectDatabase();

  const scheduler =
    createUpcomingReminderScheduler();

  try {

    await UpcomingReminderModel.init();

    console.log(
      "\n===== SCHEDULER MANUAL ====="
    );

    /*
     * Primera ejecución:
     * sincronizar y consultar.
     */
    await scheduler.runOnce();

    /*
     * Segunda ejecución:
     * comprobar que es seguro
     * ejecutarlo repetidamente.
     */
    await scheduler.runOnce();

    /*
     * Simular una comprobación
     * un minuto después de dueAt,
     * cuando sea posible.
     */
    const sample =
      await UpcomingReminderModel
        .findOne({
          status: "planned",

          window: "60m",

          kickoffAt: {
            $gt: new Date(),
          },
        })
        .sort({
          dueAt: 1,
        })
        .lean()
        .exec();

    if (sample) {

      const simulated =
        new Date(
          sample.dueAt.getTime() +
            60_000
        );

      console.log(
        "\n===== SIMULACIÓN DE HORARIO ====="
      );

      console.log(
        "Partido:",
        sample.homeName,
        "vs",
        sample.awayName
      );

      console.log(
        "Hora simulada:",
        simulated.toISOString()
      );

      const due =
        await getDueUpcomingReminders
          .execute(simulated);

      console.log({
        scanned: due.scanned,

        ready: due.ready.length,

        expiredWindow:
          due.expiredWindow,

        invalidOpportunity:
          due.invalidOpportunity,

        staleContext:
          due.staleContext,
      });

      console.table(
        due.ready.map(
          item => ({
            match:
              `${item.homeName} vs ${item.awayName}`,

            window:
              item.window,

            dueAt:
              item.dueAt.toISOString(),

            pointsGap:
              item.pointsGap,
          })
        )
      );

      /*
       * Simular un reloj no cambia
       * los estados de MongoDB.
       */
      const stored =
        await UpcomingReminderModel
          .findOne({
            matchKey:
              sample.matchKey,

            window:
              sample.window,
          })
          .lean()
          .exec();

      assert.equal(
        stored?.status,
        "planned"
      );

      assert.equal(
        stored?.sentAt ?? null,
        null
      );
    }

    console.log(
      "\nOK: scheduler ejecutado"
    );

    console.log(
      "OK: consulta de avisos vencidos"
    );

    console.log(
      "OK: sin modificación del estado de envío"
    );

    console.log(
      "OK: ningún push enviado"
    );

  } finally {

    scheduler.stop();

    await disconnectDatabase();
  }
}

void main().catch(error => {

  console.error(
    "[UpcomingReminderSchedulerTest]",
    error
  );

  process.exitCode = 1;
});

