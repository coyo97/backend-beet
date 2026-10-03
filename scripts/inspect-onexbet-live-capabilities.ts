import {
  OneXBetLiveClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

import {
  OneXBetLiveSnapshotExtractor,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveSnapshotExtractor";

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

  const snapshotExtractor =
    new OneXBetLiveSnapshotExtractor();

  console.log(
    "URL:",
    url
  );

  const html =
    await client
      .getLiveHtml();

  console.log(
    "HTML BYTES:",
    html.length
  );

  const games =
    parser.parse(
      html
    );

  console.log(
    "LIVE GAMES:",
    games.length
  );

  let snapshotsFound =
    0;

  let interestingGames =
    0;

  for (
    const game
    of games
  ) {

    const snapshot =
      snapshotExtractor
        .extract(
          html,
          game.id
        );

    if (!snapshot) {
      continue;
    }

    snapshotsFound +=
      1;

    const capabilities =
      snapshot
        .capabilityLikeFields;

    const keys =
      Object.keys(
        capabilities
      );

    if (
      keys.length ===
      0
    ) {
      continue;
    }

    interestingGames +=
      1;

    console.log(
      "\n================================"
    );

    console.log(
      game.homeName,
      "vs",
      game.awayName
    );

    console.log(
      "MATCH ID:",
      game.id
    );

    console.log(
      "CHAMPIONSHIP ID:",
      game.championshipId
    );

    console.log(
      "COMPETITION:",
      game.competitionName
    );

    console.log(
      "COUNTRY:",
      game.countryName
    );

    console.log(
      "CAPABILITIES:"
    );

    console.dir(
      capabilities,
      {
        depth:
          null,
      }
    );
  }

  console.log(
    "\n================================"
  );

  console.log(
    "SUMMARY"
  );

  console.log(
    "================================"
  );

  console.log(
    "games:",
    games.length
  );

  console.log(
    "snapshots:",
    snapshotsFound
  );

  console.log(
    "with capability fields:",
    interestingGames
  );
}

void main();
