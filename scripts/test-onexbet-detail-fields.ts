import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

async function main():
  Promise<void> {

  const url =
    process.env
      .ONEXBET_LIVE_URL ??
    "https://afg.1xbet.com/en/live/football";

  const client =
    new OneXBetLiveClient(
      url
    );

  const parser =
    new OneXBetLiveHtmlParser();

  const html =
    await client
      .getLiveHtml();

  const games =
    parser.parse(
      html
    );

  console.log(
    "LIVE GAMES:",
    games.length
  );

  const candidates =
    games.filter(
      (
        game
      ) =>
        game.hasHeadToHead
    );

  console.log(
    "H2H CANDIDATES:",
    candidates.length
  );

  for (
    const game
    of candidates
  ) {
    console.log(
      "\n=============================="
    );

    console.log({
      id:
        game.id,

      championshipId:
        game.championshipId,

      competitionName:
        game.competitionName,

      countryName:
        game.countryName,

      homeId:
        game.homeId,

      homeName:
        game.homeName,

      awayId:
        game.awayId,

      awayName:
        game.awayName,

      gameIdForUrl:
        game.gameIdForUrl,

      gameNameForUrl:
        game.gameNameForUrl,

      hasHeadToHead:
        game.hasHeadToHead,

      hasLineups:
        game.hasLineups,

      hasTimeline:
        game.hasTimeline,
    });
  }
}

void main();
