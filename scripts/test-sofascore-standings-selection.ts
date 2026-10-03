import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

import {
  SofascoreStandingsBrowserProvider,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreStandingsBrowserProvider";

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  const provider =
    new SofascoreStandingsBrowserProvider(
      browser
    );

  try {
    /*
     * =================================
     * CASO ANTERIOR:
     * SFF Sibir sin selección explícita
     * =================================
     */

    const sibir =
      await provider
        .getStandings(
          "https://www.sofascore.com/es/football/tournament/russia-amateur/championship-sff-sibir/20768#id:90865"
        );

    console.log(
      "\n========================"
    );

    console.log(
      "SFF SIBIR"
    );

    console.log(
      "========================"
    );

    console.log(
      "TOURNAMENT:",
      sibir.tournamentName
    );

    console.log(
      "ROWS:",
      sibir.rows.length
    );

    console.log(
      sibir.rows.map(
        (
          row
        ) => ({
          position:
            row.position,

          team:
            row.team.name,

          points:
            row.points,
        })
      )
    );

    /*
     * =================================
     * NUEVO CASO:
     * CMCL con fase EXACTA
     * =================================
     */

    const china =
      await provider
        .getStandings(
          "https://www.sofascore.com/football/tournament/china/cmcl-champions-league/35616#id:96779",
          {
            tournamentId:
              "194069",
          }
        );

    console.log(
      "\n========================"
    );

    console.log(
      "CHINA SOUTH GROUP"
    );

    console.log(
      "========================"
    );

    console.log(
      "TOURNAMENT:",
      china.tournamentName
    );

    console.log(
      "SEASON:",
      china.seasonName
    );

    console.log(
      "SEASON ID:",
      china.seasonId
    );

    console.log(
      "ROWS:",
      china.rows.length
    );

    console.log(
      china.rows.map(
        (
          row
        ) => ({
          position:
            row.position,

          team:
            row.team.name,

          played:
            row.matches,

          wins:
            row.wins,

          draws:
            row.draws,

          losses:
            row.losses,

          goalsFor:
            row.scoresFor,

          goalsAgainst:
            row.scoresAgainst,

          points:
            row.points,
        })
      )
    );

    console.log(
      "\n===== TARGET TEAMS ====="
    );

    console.log(
      china.rows.filter(
        (
          row
        ) =>
          /guangdong chenxing|wuhan lianzhen/i
            .test(
              row.team.name
            )
      )
    );

    /*
     * =================================
     * SAFETY TEST
     *
     * Un ID inexistente DEBE fallar.
     * No debe retornar otro grupo.
     * =================================
     */

    try {
      await provider
        .getStandings(
          "https://www.sofascore.com/football/tournament/china/cmcl-champions-league/35616#id:96779",
          {
            tournamentId:
              "999999999",
          }
        );

      console.error(
        "ERROR: invalid tournamentId unexpectedly returned standings"
      );
    } catch (
      error
    ) {
      console.log(
        "\nSAFETY TEST: OK"
      );

      console.log(
        error instanceof
          Error
          ? error.message
          : error
      );
    }
  } finally {
    await browser.stop();
  }
}

void main();
