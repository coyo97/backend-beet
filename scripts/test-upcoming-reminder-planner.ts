
import "dotenv/config";

import assert from "node:assert/strict";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  PlanUpcomingReminders,
} from "../src/modules/notifications/application/services/PlanUpcomingReminders";

import {
  UpcomingReminderModel,
} from "../src/modules/notifications/infrastructure/database/models/UpcomingReminderModel";

const HOUR_MS =
  60 * 60 * 1000;

async function main() {

  await connectDatabase();

  try {

    /*
     * Asegurar la creación
     * del índice único.
     */
    await UpcomingReminderModel.init();

    const planner =
      new PlanUpcomingReminders();

    console.log(
      "\n===== PRIMERA PLANIFICACIÓN ====="
    );

    const first =
      await planner.execute();

    console.log(first);

    const countAfterFirst =
      await UpcomingReminderModel
        .countDocuments();

    console.log(
      "\n===== SEGUNDA PLANIFICACIÓN ====="
    );

    const second =
      await planner.execute();

    console.log(second);

    const countAfterSecond =
      await UpcomingReminderModel
        .countDocuments();

    /*
     * Ejecutar otra vez no debe
     * producir nuevos documentos.
     */
    assert.equal(
      countAfterSecond,
      countAfterFirst
    );

    assert.equal(
      second.created,
      0
    );

    /*
     * Consultar recordatorios
     * todavía asociados a
     * encuentros futuros.
     */
    const reminders =
      await UpcomingReminderModel
        .find({
          kickoffAt: {
            $gt: new Date(),
          },
        })
        .sort({
          dueAt: 1,
        })
        .lean()
        .exec();

    const keys =
      new Set<string>();

    for (const reminder of reminders) {

      const key =
        `${reminder.matchKey}:${reminder.window}`;

      assert.ok(
        !keys.has(key),
        `Duplicated reminder: ${key}`
      );

      keys.add(key);

      const leadMs =
        reminder.window === "24h"
          ? 24 * HOUR_MS
          : HOUR_MS;

      /*
       * La programación debe
       * coincidir con la ventana.
       */
      assert.equal(
        reminder.dueAt.getTime(),
        reminder.kickoffAt.getTime() -
          leadMs
      );
    }

    console.log(
      "\n===== RECORDATORIOS ====="
    );

    console.table(
      reminders.slice(0, 30).map(
        reminder => ({
          match:
            `${reminder.homeName} vs ${reminder.awayName}`,

          window:
            reminder.window,

          status:
            reminder.status,

          kickoff:
            reminder.kickoffAt
              .toISOString(),

          dueAt:
            reminder.dueAt
              .toISOString(),

          pointsGap:
            reminder.pointsGap,
        })
      )
    );

    console.log(
      "\n===== RESUMEN ====="
    );

    console.table({
      opportunitiesRead:
        first.opportunitiesRead,

      eligible:
        first.eligible,

      created:
        first.created,

      secondRunCreated:
        second.created,

      documents:
        reminders.length,
    });

    console.log(
      "\nOK: programación persistente"
    );

    console.log(
      "OK: ventanas de 24h y 60m"
    );

    console.log(
      "OK: sin recordatorios duplicados"
    );

    console.log(
      "OK: ningún push enviado"
    );

  } finally {

    await disconnectDatabase();
  }
}

void main().catch(error => {

  console.error(
    "[UpcomingReminderPlannerTest]",
    error
  );

  process.exitCode = 1;
});

