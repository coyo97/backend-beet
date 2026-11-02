
import "dotenv/config";

import assert from "node:assert/strict";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/shared/infrastructure/database/mongoose";

import {
  FlashscoreUpcomingMatchesProvider,
} from "../src/modules/football/infrastructure/providers/flashscore/FlashscoreUpcomingMatchesProvider";

import {
  GetUpcomingMatches,
} from "../src/modules/football/application/use-cases/GetUpcomingMatches";

import {
  UpcomingLeagueCandidateScanner,
} from "../src/modules/opportunity-filter/application/services/UpcomingLeagueCandidateScanner";

import {
  UpcomingOpportunityReviewQueue,
} from "../src/modules/opportunity-filter/application/services/UpcomingOpportunityReviewQueue";

import {
  MongooseUpcomingOpportunityRepository,
} from "../src/modules/opportunity-filter/infrastructure/repositories/MongooseUpcomingOpportunityRepository";

import {
  UpcomingOpportunityModel,
} from "../src/modules/opportunity-filter/infrastructure/database/models/UpcomingOpportunityModel";

import {
  getLiveOpportunities,
} from "../src/modules/opportunity-filter/opportunityFilterModule";

async function main() {

  await connectDatabase();

  try {

    /*
     * Asegurar que el índice único
     * esté creado antes de probar
     * la deduplicación.
     */
    await UpcomingOpportunityModel.init();

    const upcoming =
      new GetUpcomingMatches(
        new FlashscoreUpcomingMatchesProvider()
      );

    const scanner =
      new UpcomingLeagueCandidateScanner(
        upcoming
      );

    const queue =
      new UpcomingOpportunityReviewQueue(
        getLiveOpportunities
      );

    const repository =
      new MongooseUpcomingOpportunityRepository();

    /*
     * Dos lotes con la misma instancia
     * para comprobar la rotación.
     */
    for (const maxLeagues of [5, 2]) {

      const scan =
        await scanner.execute({
          hours: 48,
          maxLeagues,
        });

      const added =
        queue.add(
          scan.candidates
        );

      console.log(
        "[UpcomingPersistence] scan",
        {
          leagues: scan.scannedLeagues,
          candidates: scan.candidates.length,
          added,
        }
      );
    }

    /*
     * Dos lotes de validación:
     * máximo cuatro intentos
     * de contexto profundo.
     */
    const first =
      await queue.review(2);

    const second =
      await queue.review(2);

    const confirmed = [
      ...first.confirmed,
      ...second.confirmed,
    ];

    /*
     * Evitar usar encuentros que
     * comienzan en los próximos
     * cinco minutos durante
     * esta prueba.
     */
    const eligible =
      confirmed.filter(
        item =>
          Date.parse(
            item.match.kickoffAt
          ) >
          Date.now() + 5 * 60 * 1000
      );

    console.log(
      "\n===== CONFIRMADOS ====="
    );

    console.log({
      confirmed: confirmed.length,
      eligible: eligible.length,
      pending: queue.size(),
    });

    if (eligible.length === 0) {

      console.log(
        "Sin encuentros elegibles para probar persistencia."
      );

      return;
    }

    /*
     * Primera escritura.
     */
    const saved =
      await repository.saveMany(
        eligible
      );

    /*
     * Segunda escritura:
     * los mismos encuentros.
     */
    const savedAgain =
      await repository.saveMany(
        eligible
      );

    const keys =
      [...new Set(
        eligible.map(
          item => item.key
        )
      )];

    /*
     * Leer los registros reales.
     */
    const records =
      await UpcomingOpportunityModel
        .find({
          matchKey: {
            $in: keys,
          },
        })
        .lean()
        .exec();

    /*
     * No debe existir más
     * de un documento por clave.
     */
    assert.equal(
      records.length,
      keys.length
    );

    for (const opportunity of eligible) {

      const stored =
        records.find(
          item =>
            item.matchKey ===
            opportunity.key
        );

      assert.ok(stored);

      assert.equal(
        stored.homePoints,
        opportunity.standings.homePoints
      );

      assert.equal(
        stored.awayPoints,
        opportunity.standings.awayPoints
      );

      assert.equal(
        stored.homePosition,
        opportunity.standings.homePosition
      );

      assert.equal(
        stored.awayPosition,
        opportunity.standings.awayPosition
      );

      assert.equal(
        stored.pointsGap,
        opportunity.evaluation.pointsGap
      );
    }

    console.log(
      "\n===== MONGODB ====="
    );

    console.table(
      records.map(
        item => ({
          match:
            `${item.homeName} vs ${item.awayName}`,

          level:
            item.level,

          table:
            `${item.homePosition}.º vs ${item.awayPosition}.º`,

          points:
            `${item.homePoints} vs ${item.awayPoints}`,

          pointsGap:
            item.pointsGap,

          kickoff:
            item.kickoffAt.toISOString(),
        })
      )
    );

    console.log(
      "\n===== RESULTADO ====="
    );

    console.table({
      uniqueMatches: keys.length,
      firstSave: saved,
      secondSave: savedAgain,
      documentsInMongo: records.length,
    });

    console.log(
      "\nOK: persistencia en MongoDB"
    );

    console.log(
      "OK: puntos y posiciones reales"
    );

    console.log(
      "OK: sin duplicados tras actualizar"
    );

  } finally {

    await disconnectDatabase();
  }
}

void main().catch(error => {

  console.error(
    "[UpcomingPersistenceTest]",
    error
  );

  process.exitCode = 1;
});

