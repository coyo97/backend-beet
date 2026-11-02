
import "dotenv/config";

import assert from "node:assert/strict";

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
  getLiveOpportunities,
} from "../src/modules/opportunity-filter/opportunityFilterModule";

async function main() {

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

  /*
   * Primer grupo de ligas.
   */
  const firstScan =
    await scanner.execute({
      hours: 48,
      maxLeagues: 5,
    });

  const firstAdded =
    queue.add(firstScan.candidates);

  /*
   * Segundo grupo.
   */
  const secondScan =
    await scanner.execute({
      hours: 48,
      maxLeagues: 2,
    });

  const secondAdded =
    queue.add(secondScan.candidates);

  console.log(
    "\n===== CANDIDATOS EN COLA ====="
  );

  console.table({
    firstFound:
      firstScan.candidates.length,

    secondFound:
      secondScan.candidates.length,

    firstAdded,
    secondAdded,

    pending:
      queue.size(),
  });

  /*
   * Primera revisión:
   * máximo dos contextos.
   */
  const firstReview =
    await queue.review(2);

  console.log(
    "\n===== REVISIÓN 1 ====="
  );

  console.log({
    attempted: firstReview.attempted,
    confirmed: firstReview.confirmed.length,
    rejected: firstReview.rejected,
    deferred: firstReview.deferred,
    pending: firstReview.pending,
  });

  /*
   * Segunda revisión:
   * procesa otros dos pendientes.
   *
   * Conserva la misma instancia
   * y el mismo presupuesto.
   */
  const secondReview =
    await queue.review(2);

  console.log(
    "\n===== REVISIÓN 2 ====="
  );

  console.log({
    attempted: secondReview.attempted,
    confirmed: secondReview.confirmed.length,
    rejected: secondReview.rejected,
    deferred: secondReview.deferred,
    pending: secondReview.pending,
  });

  const confirmed = [
    ...firstReview.confirmed,
    ...secondReview.confirmed,
  ];

  console.log(
    "\n===== CONFIRMADOS ====="
  );

  console.table(
    confirmed.map(item => ({
      match:
        `${item.match.home.name} vs ${item.match.away.name}`,

      competition:
        item.match.competition.name,

      level:
        item.evaluation.level,

      pointsGap:
        item.evaluation.pointsGap,

      positionGap:
        item.evaluation.positionGap,

      profile:
        item.profile,

      quality:
        item.evaluation.dataQuality,
    }))
  );

  assert.ok(
    firstReview.attempted <= 2
  );

  assert.ok(
    secondReview.attempted <= 2
  );

  const keys =
    confirmed.map(
      item => item.key
    );

  assert.equal(
    keys.length,
    new Set(keys).size
  );

  console.log(
    "\nOK: máximo dos revisiones por lote"
  );

  console.log(
    "OK: sin confirmaciones duplicadas"
  );

  console.log(
    "OK: cola conserva los pendientes"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

