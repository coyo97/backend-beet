
import "dotenv/config";

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
  getLiveOpportunities,
} from "../src/modules/opportunity-filter/opportunityFilterModule";

import {
  MatchOpportunityScorer,
} from "../src/modules/opportunity-filter/domain/services/MatchOpportunityScorer";

import {
  UpcomingMatchEvaluator,
} from "../src/modules/opportunity-filter/domain/services/UpcomingMatchEvaluator";

async function main() {

  const upcoming =
    new GetUpcomingMatches(
      new FlashscoreUpcomingMatchesProvider()
    );

  const scanner =
    new UpcomingLeagueCandidateScanner(
      upcoming
    );

  const scorer =
    new MatchOpportunityScorer();

  const evaluator =
    new UpcomingMatchEvaluator();

  const allCandidates = [];

  /*
   * Primera ejecución:
   * cinco competiciones.
   */
  const first =
    await scanner.execute({
      hours: 48,
      maxLeagues: 5,
    });

  allCandidates.push(
    ...first.candidates
  );

  console.log(
    "\n===== ESCANEO 1 ====="
  );

  console.log({
    upcoming: first.totalUpcoming,
    leagues: first.totalLeagues,
    scanned: first.scannedLeagues,
    matched: first.matchedMatches,
    missing: first.missingMatches,
    standingsRequests:
      first.standingsRequests,
    candidates: first.candidates.length,
  });

  /*
   * Segunda ejecución:
   * otras dos competiciones.
   *
   * Permite verificar rotación.
   */
  const second =
    await scanner.execute({
      hours: 48,
      maxLeagues: 2,
    });

  allCandidates.push(
    ...second.candidates
  );

  console.log(
    "\n===== ESCANEO 2 ====="
  );

  console.log({
    scanned: second.scannedLeagues,
    matched: second.matchedMatches,
    missing: second.missingMatches,
    standingsRequests:
      second.standingsRequests,
    candidates: second.candidates.length,
  });

  console.log(
    "\n===== CANDIDATOS PRELIMINARES ====="
  );

  console.table(
    allCandidates.map(item => ({
      match:
        `${item.match.home.name} vs ${item.match.away.name}`,

      competition:
        item.match.competition.name,

      pointsGap:
        item.pointsGap,

      positionGap:
        item.positionGap,

      ppgGap:
        item.ppgGap,

      priority:
        item.priority,
    }))
  );

  /*
   * Validación profunda:
   *
   * Solo dos candidatos.
   * No analizar todo el catálogo.
   */
  const selected =
    allCandidates
      .filter(
        item =>
          item.priority === "high"
      )
      .slice(0, 2);

  console.log(
    "\n===== VALIDACIÓN PROFUNDA ====="
  );

  let confirmed = 0;

  for (const candidate of selected) {

    const match = candidate.match;

    console.log(
      "\nPARTIDO:",
      match.home.name,
      "vs",
      match.away.name
    );

    try {

      const context =
        await getLiveOpportunities
          .getOrWarmContext(match);

      if (!context) {
        console.log(
          "Sin contexto profundo"
        );
        continue;
      }

      const validTable =
        context.competition.tableAvailable &&
        context.competition.tableScope ===
          "competition" &&
        context.availability.standings;

      /*
       * Confirmamos que los datos
       * del partido específico
       * coinciden con los utilizados
       * en la preselección por liga.
       *
       * Si provienen de otra tabla,
       * no afirmamos la diferencia.
       */
      const sameStandings =
        validTable &&
        context.home.position ===
          candidate.homePosition &&
        context.away.position ===
          candidate.awayPosition &&
        context.home.points ===
          candidate.homePoints &&
        context.away.points ===
          candidate.awayPoints;

      if (!sameStandings) {

        console.log(
          "DESCARTADO: tabla no coincide"
        );

        continue;
      }

      const scored =
        scorer.score(
          match,
          context
        );

      const evaluation =
        evaluator.evaluate({
          match,

          home: scored.home,

          away: scored.away,

          hasTable: true,

          dataQuality:
            scored.dataQuality,

          favoredSide:
            scored.favoredSide,
        });

      console.log(
        "Scorer:",
        {
          profile:
            scored.profile,

          favoredSide:
            scored.favoredSide,

          dataQuality:
            scored.dataQuality,

          adjustedGap:
            scored.adjustedGap,
        }
      );

      console.log(
        "Evaluación final:",
        evaluation
      );

      if (evaluation) {
        confirmed++;
      }

    } catch (error) {

      console.error(
        "Error:",
        error instanceof Error
          ? error.message
          : error
      );
    }
  }

  console.log(
    "\n===== RESULTADO FINAL ====="
  );

  console.table({
    preliminary:
      allCandidates.length,

    deepSelected:
      selected.length,

    deepConfirmed:
      confirmed,
  });

  console.log(
    "\nFIN DE PRUEBA"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

