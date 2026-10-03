import {
  OneXBetLiveClient,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveHtmlParser";

import {
  OneXBetLiveProvider,
} from "../../src/modules/football/infrastructure/providers/onexbet/OneXBetLiveProvider";

import {
  FotMobClient,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobMatchResolver,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobMatchResolver";

async function main() {

  const oneXBet =
    new OneXBetLiveProvider(
      new OneXBetLiveClient(
        process.env
          .ONEXBET_LIVE_URL ??
        "https://afg.1xbet.com/en/live/football"
      ),

      new OneXBetLiveHtmlParser()
    );

  const fotMobClient =
    new FotMobClient();

  const resolver =
    new FotMobMatchResolver(
      fotMobClient
    );

  const live =
    await oneXBet
      .getLiveMatches();

  console.log(
    "1xBet live:",
    live.length
  );

  let resolved =
    0;

  /*
   * Primero 20.
   *
   * No hace falta probar cientos
   * mientras desarrollamos.
   */
  for (
    const match
    of live.slice(
      0,
      20
    )
  ) {

    const result =
      await resolver
        .resolve(
          match
        );

    console.log(
      "\n--------------------------------"
    );

    console.log(
      `${match.competition.name}`
    );

    console.log(
      `1XBET: ${match.home.name} vs ${match.away.name}`
    );

    if (!result) {

      console.log(
        "FOTMOB: sin coincidencia"
      );

      continue;
    }

    resolved +=
      1;

    console.log(
      `FOTMOB: ${result.homeName} vs ${result.awayName}`
    );

    console.log(
      "matchId:",
      result.externalId
    );

    console.log(
      "league:",
      result.competitionName
    );

    console.log(
      "confidence:",
      result.confidence
        .toFixed(
          3
        )
    );
  }

  console.log(
    "\n================================"
  );

  console.log(
    "Probados:",
    Math.min(
      live.length,
      20
    )
  );

  console.log(
    "Resueltos en FotMob:",
    resolved
  );
}

void main();
