import {
  readFile,
} from "node:fs/promises";

import {
  OneXBetLiveHtmlParser,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

async function main() {

  const html =
    await readFile(
      "/tmp/1xbet-live.html",
      "utf8"
    );

  const parser =
    new OneXBetLiveHtmlParser();

  const games =
    parser.parse(
      html
    );

  console.log(
    "1xBet live games:",
    games.length
  );

  for (
    const game
    of games.slice(
      0,
      30
    )
  ) {
    console.log({
      id:
        game.id,

      competition:
        game.competitionName,

      country:
        game.countryName,

      home:
        game.homeName,

      away:
        game.awayName,

      score:
        `${game.homeScore ?? "-"}-${game.awayScore ?? "-"}`,

      clock:
        game.clock,
    });
  }
}

void main();
