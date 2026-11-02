
import "dotenv/config";

import {
  FlashscoreUpcomingMatchesProvider,
} from "../src/modules/football/infrastructure/providers/flashscore/FlashscoreUpcomingMatchesProvider";

import {
  GetUpcomingMatches,
} from "../src/modules/football/application/use-cases/GetUpcomingMatches";

import {
  getLiveOpportunities,
} from "../src/modules/opportunity-filter/opportunityFilterModule";

import {
  MatchOpportunityScorer,
} from "../src/modules/opportunity-filter/domain/services/MatchOpportunityScorer";

import {
  UpcomingMatchEvaluator,
} from "../src/modules/opportunity-filter/domain/services/UpcomingMatchEvaluator";

function isLeague(
  competition: string
): boolean {

  /*
   * Solo para esta prueba:
   *
   * Preferimos ligas donde tiene
   * sentido comparar posiciones
   * y puntos de una tabla.
   *
   * Esto NO es un filtro global
   * de Football Radar.
   */
  const excluded =
    /cup|copa|qualif|friendly|amistoso|playoff|champions|confederation/i;

  const included =
    /league|liga|ligue|serie|division|bundesliga|primera/i;

  return (
    included.test(competition) &&
    !excluded.test(competition)
  );
}

function priority(
  competition: string
): number {

  const names = [
    "J1 League",
    "J2 League",
    "K League 2",
    "Primera Nacional",
  ];

  const index =
    names.findIndex(
      name =>
        competition === name
    );

  return index >= 0
    ? index
    : 100;
}

async function main() {

  const upcoming =
    new GetUpcomingMatches(
      new FlashscoreUpcomingMatchesProvider()
    );

  const scorer =
    new MatchOpportunityScorer();

  const evaluator =
    new UpcomingMatchEvaluator();

  const matches =
    await upcoming.execute({
      hours: 48,
      limit: 5000,
    });

  console.log(
    "\n===== DESCUBRIMIENTO ====="
  );

  console.log(
    "Programados:",
    matches.length
  );

  /*
   * Escogemos un máximo de
   * tres encuentros de ligas
   * distintas.
   *
   * No analizamos 1294 partidos.
   */
  const candidates =
    matches
      .filter(
        match =>
          isLeague(
            match.competition.name
          )
      )
      .sort(
        (a, b) =>
          priority(a.competition.name) -
          priority(b.competition.name)
      );

  const selected:
    typeof matches = [];

  const seenCompetitions =
    new Set<string>();

  for (const match of candidates) {

    if (selected.length >= 3) {
      break;
    }

    const key = [
      match.competition.country,
      match.competition.name,
    ].join(":");

    if (
      seenCompetitions.has(key)
    ) {
      continue;
    }

    seenCompetitions.add(key);
    selected.push(match);
  }

  console.log(
    "Seleccionados:",
    selected.length
  );

  let withContext = 0;
  let withTable = 0;
  let withEvaluation = 0;

  for (const match of selected) {

    console.log(
      "\n================================"
    );

    console.log(
      `${match.home.name} vs ${match.away.name}`
    );

    console.log(
      "Competición:",
      match.competition.name
    );

    console.log(
      "Inicio:",
      match.kickoffAt
    );

    try {

      /*
       * Respeta el presupuesto
       * global existente en esta
       * instancia del backend.
       */
      const context =
        await getLiveOpportunities
          .getOrWarmContext(match);

      if (!context) {

        console.log(
          "CONTEXTO: NO DISPONIBLE"
        );

        continue;
      }

      withContext++;

      /*
       * No basta con recibir datos.
       * La tabla debe corresponder
       * a la misma competición
       * y contener ambos equipos.
       */
      const validTable =
        context.competition.tableAvailable &&
        context.competition.tableScope ===
          "competition" &&
        context.availability.standings &&
        context.home.position !== null &&
        context.away.position !== null &&
        context.home.points !== null &&
        context.away.points !== null;

      if (validTable) {
        withTable++;
      }

      console.log(
        "CONTEXTO:",
        {
          source:
            context.source,

          tableAvailable:
            validTable,

          recentForm:
            context.availability.recentForm,

          home: {
            name:
              context.home.name,

            position:
              context.home.position,

            points:
              context.home.points,

            played:
              context.home.played,

            form:
              context.home.form,
          },

          away: {
            name:
              context.away.name,

            position:
              context.away.position,

            points:
              context.away.points,

            played:
              context.away.played,

            form:
              context.away.form,
          },
        }
      );

      /*
       * Evaluador que ya existía
       * en Football Radar.
       */
      const scored =
        scorer.score(
          match,
          context
        );

      console.log(
        "SCORER:",
        {
          profile:
            scored.profile,

          favoredSide:
            scored.favoredSide,

          dataQuality:
            scored.dataQuality,

          adjustedGap:
            scored.adjustedGap,

          dangerousOpponent:
            scored.signals.includes(
              "dangerous-underdog"
            ),
        }
      );

      /*
       * Nuevo evaluador:
       * diferencias de puntos,
       * posiciones y rendimiento.
       */
      const evaluation =
        evaluator.evaluate({
          match,

          home:
            scored.home,

          away:
            scored.away,

          hasTable:
            validTable,

          dataQuality:
            scored.dataQuality,

          favoredSide:
            scored.favoredSide,
        });

      if (evaluation) {

        withEvaluation++;

        console.log(
          "EVALUACIÓN:",
          evaluation
        );

      } else {

        console.log(
          "EVALUACIÓN: sin alerta",
          "(no cumple condiciones)"
        );
      }

    } catch (error) {

      console.error(
        "ERROR DE ANÁLISIS:",
        error instanceof Error
          ? error.message
          : error
      );
    }
  }

  console.log(
    "\n===== RESUMEN ====="
  );

  console.table({
    upcoming: matches.length,
    selected: selected.length,
    withContext,
    withTable,
    withEvaluation,
  });

  console.log(
    "\nFIN DE PRUEBA"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

