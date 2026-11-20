import "dotenv/config";

import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

async function main(): Promise<void> {

  const url =
    process.env.ONEXBET_LIVE_URL ??
    "https://afg.1xbet.com/en/live/football";

  const client =
    new OneXBetLiveClient(
      url,
      15_000
    );

  const parser =
    new OneXBetLiveHtmlParser();

  /*
   * Una sola obtención del HTML.
   * No consultamos cada partido.
   */
  const html =
    await client.getLiveHtml();

  const games =
    parser.parse(html);

  console.log(
    "\n========== NAVEGACIÓN 1XBET =========="
  );

  console.log(
    "Partidos detectados:",
    games.length
  );

  const withGameName =
    games.filter(
      game =>
        Boolean(game.gameNameForUrl)
    );

  const withGameId =
    games.filter(
      game =>
        Boolean(game.gameIdForUrl)
    );

  console.log(
    "Con gameNameForUrl:",
    withGameName.length
  );

  console.log(
    "Con gameIdForUrl:",
    withGameId.length
  );

  /*
   * Comprobar si el HTML contiene
   * datos de navegación de ligas.
   *
   * Solo diagnóstico: no asignamos
   * automáticamente un campeonato
   * a un encuentro.
   */
  console.log(
    "HTML contiene champNameForUrl:",
    html.includes("champNameForUrl")
  );

  console.log(
    "HTML contiene sectionChampId:",
    html.includes("sectionChampId")
  );

  console.log(
    "\n--- PARTIDOS ---"
  );

  for (
    const game of games.slice(0, 15)
  ) {

    console.log(
      JSON.stringify(
        {
          home: game.homeName,
          away: game.awayName,

          id: game.id,

          championshipId:
            game.championshipId,

          competition:
            game.competitionName,

          gameIdForUrl:
            game.gameIdForUrl,

          gameNameForUrl:
            game.gameNameForUrl,
		  champNameForUrl:
  game.champNameForUrl,

sectionChampId:
  game.sectionChampId,
        },
        null,
        2
      )
    );
  }

  console.log(
    "\n========== FIN =========="
  );
}

main().catch(error => {
  console.error(
    "[OneXBetNavigation] ERROR",
    error
  );

  process.exitCode = 1;
});
