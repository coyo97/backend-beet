
import "dotenv/config";

import type {
  LiveMatch,
  LiveTeam,
} from "../src/modules/football/domain/entities/LiveMatch";

import {
  FlashscoreUpcomingMatchesProvider,
} from "../src/modules/football/infrastructure/providers/flashscore/FlashscoreUpcomingMatchesProvider";

import {
  GetUpcomingMatches,
} from "../src/modules/football/application/use-cases/GetUpcomingMatches";

import {
  FlashscoreMatchContextClient,
  type FlashscoreStandingRow,
} from "../src/modules/match-context/infrastructure/flashscore/FlashscoreMatchContextClient";

const MAX_LEAGUES = 5;

const preferred = [
  "J1 League",
  "J2 League",
  "K League 2",
  "Primera Nacional",
  "Serie D - Group C",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isLeague(name: string): boolean {
  const excluded =
    /cup|copa|qualif|friendly|playoff|champions|confederation/i;

  const included =
    /league|liga|ligue|serie|division|primera|bundesliga|oberliga|tercera/i;

  return (
    included.test(name) &&
    !excluded.test(name)
  );
}

function findTeam(
  rows: FlashscoreStandingRow[],
  team: LiveTeam
): FlashscoreStandingRow | null {

  /*
   * Comparar identificadores primero.
   */
  if (team.id) {
    const byId = rows.find(
      row =>
        row.team.id !== null &&
        String(row.team.id) ===
          String(team.id)
    );

    if (byId) {
      return byId;
    }
  }

  /*
   * Fallback: nombre exacto
   * normalizado, dentro de la
   * misma competición.
   */
  return (
    rows.find(
      row =>
        normalize(row.team.name) ===
        normalize(team.name)
    ) ?? null
  );
}

function groupMatches(
  matches: LiveMatch[]
): LiveMatch[][] {

  const groups =
    new Map<string, LiveMatch[]>();

  for (const match of matches) {

    if (
      !isLeague(match.competition.name)
    ) {
      continue;
    }

    const key = [
      match.competition.country,
      match.competition.name,
      match.competition.id ?? "",
    ].join("::");

    const current =
      groups.get(key) ?? [];

    current.push(match);
    groups.set(key, current);
  }

  return [...groups.values()]
    .filter(group => group.length >= 2)
    .sort((a, b) => {

      const aIndex =
        preferred.indexOf(
          a[0].competition.name
        );

      const bIndex =
        preferred.indexOf(
          b[0].competition.name
        );

      const aPriority =
        aIndex >= 0 ? aIndex : 100;

      const bPriority =
        bIndex >= 0 ? bIndex : 100;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      return b.length - a.length;
    })
    .slice(0, MAX_LEAGUES);
}

async function main() {

  const upcoming =
    new GetUpcomingMatches(
      new FlashscoreUpcomingMatchesProvider()
    );

  const contextClient =
    new FlashscoreMatchContextClient();

  const matches =
    await upcoming.execute({
      hours: 48,
      limit: 5000,
    });

  const groups =
    groupMatches(matches);

  console.log(
    "\n===== CLASIFICACIONES POR LIGA ====="
  );

  console.log(
    "Programados:",
    matches.length
  );

  console.log(
    "Ligas seleccionadas:",
    groups.length
  );

  let coveredMatches = 0;
  let missingMatches = 0;
  let candidates = 0;

  for (const group of groups) {

    const first = group[0];

    const source =
      first.sources.find(
        item =>
          item.provider === "flashscore"
      );

    if (!source) {
      continue;
    }

    console.log(
      "\n================================"
    );

    console.log(
      "Liga:",
      first.competition.name
    );

    console.log(
      "País:",
      first.competition.country
    );

    console.log(
      "Partidos programados:",
      group.length
    );

    try {

      /*
       * Una sola consulta de tabla
       * para esta competición.
       */
      const standings =
        await contextClient.getStandings(
          source.externalId
        );

      const rows =
        standings?.standings ?? [];

      console.log(
        "Filas de clasificación:",
        rows.length
      );

      const comparisons: Array<{
        match: string;
        leader: string;
        pointsGap: number;
        positionGap: number;
        ppgGap: number | null;
        priority: string;
      }> = [];

      for (const match of group) {

        const home =
          findTeam(rows, match.home);

        const away =
          findTeam(rows, match.away);

        if (
          !home ||
          !away ||
          home.points === null ||
          away.points === null ||
          !Number.isFinite(home.rank) ||
          !Number.isFinite(away.rank)
        ) {

          missingMatches++;
          continue;
        }

        coveredMatches++;

        if (
          home.points === away.points
        ) {
          continue;
        }

        const leader =
          home.points > away.points
            ? home
            : away;

        const opponent =
          home.points > away.points
            ? away
            : home;

        /*
         * Puntos y posiciones deben
         * apuntar al mismo líder.
         */
        if (
          leader.rank >= opponent.rank
        ) {
          continue;
        }

        const pointsGap =
          leader.points! -
          opponent.points!;

        const positionGap =
          opponent.rank -
          leader.rank;

        const leaderPlayed =
          leader.matches_played;

        const opponentPlayed =
          opponent.matches_played;

        let ppgGap: number | null =
          null;

        if (
          leaderPlayed !== null &&
          opponentPlayed !== null &&
          leaderPlayed > 0 &&
          opponentPlayed > 0
        ) {
          ppgGap =
            leader.points! / leaderPlayed -
            opponent.points! / opponentPlayed;
        }

        /*
         * Solo candidatos preliminares.
         * No enviar notificaciones aquí.
         */
        let priority = "none";

        if (
          pointsGap >= 15 &&
          positionGap >= 5
        ) {
          priority = "high";
        } else if (
          pointsGap >= 10 &&
          positionGap >= 3
        ) {
          priority = "watch";
        }

        /*
         * Evitar comparaciones engañosas
         * cuando la diferencia puede
         * depender de partidos jugados.
         */
        if (
          ppgGap !== null &&
          ppgGap < -0.05
        ) {
          priority = "none";
        }

        if (priority !== "none") {
          candidates++;
        }

        comparisons.push({
          match:
            `${match.home.name} vs ${match.away.name}`,

          leader:
            leader.team.name,

          pointsGap,
          positionGap,

          ppgGap:
            ppgGap === null
              ? null
              : Number(
                  ppgGap.toFixed(2)
                ),

          priority,
        });
      }

      /*
       * Mostrar los enfrentamientos
       * con mayor diferencia, incluso
       * cuando no alcancen el umbral.
       */
      comparisons.sort(
        (a, b) =>
          b.pointsGap - a.pointsGap
      );

      console.table(
        comparisons.slice(0, 10)
      );

    } catch (error) {

      console.error(
        "Error de clasificación:",
        error instanceof Error
          ? error.message
          : error
      );
    }
  }

  console.log(
    "\n===== RESUMEN GENERAL ====="
  );

  console.table({
    upcoming: matches.length,
    leaguesChecked: groups.length,
    coveredMatches,
    missingMatches,
    preliminaryCandidates: candidates,
  });

  console.log(
    "\nFIN DE PRUEBA"
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

