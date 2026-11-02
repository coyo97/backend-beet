
import "dotenv/config";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  createUpcomingOpportunityScheduler,
} from "../src/modules/opportunity-filter/upcomingOpportunityModule";

import {
  UpcomingOpportunityModel,
} from "../src/modules/opportunity-filter/infrastructure/database/models/UpcomingOpportunityModel";

async function main() {

  await connectDatabase();

  const scheduler =
    createUpcomingOpportunityScheduler();

  try {
    await UpcomingOpportunityModel.init();

    console.log(
      "\n===== SCHEDULER: EJECUCIÓN MANUAL ====="
    );

    /*
     * Un solo ciclo:
     * - cinco ligas
     * - máximo dos revisiones
     * - guardar confirmados
     */
    await scheduler.runOnce();

    /*
     * Consultar registros que
     * todavía no han comenzado.
     */
    const records =
      await UpcomingOpportunityModel
        .find({
          kickoffAt: {
            $gt: new Date(),
          },
        })
        .sort({
          kickoffAt: 1,
        })
        .limit(10)
        .lean()
        .exec();

    console.log(
      "\n===== ENCUENTROS CONFIRMADOS EN MONGO ====="
    );

    console.table(
      records.map(item => ({
        match:
          `${item.homeName} vs ${item.awayName}`,

        competition:
          item.competitionName,

        level:
          item.level,

        position:
          `${item.homePosition} vs ${item.awayPosition}`,

        points:
          `${item.homePoints} vs ${item.awayPoints}`,

        kickoff:
          item.kickoffAt.toISOString(),
      }))
    );

    console.log(
      "\nOK: ejecución terminada"
    );

  } finally {
    scheduler.stop();

    await disconnectDatabase();
  }
}

void main().catch(error => {
  console.error(
    "[UpcomingSchedulerTest]",
    error
  );

  process.exitCode = 1;
});

