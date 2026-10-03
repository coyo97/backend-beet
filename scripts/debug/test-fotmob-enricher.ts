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
  FotMobFixtureCatalog,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobFixtureCatalog";

import {
  FotMobMatchResolver,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobMatchResolver";

import {
  FotMobEnrichingFootballProvider,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobEnrichingFootballProvider";

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

  const catalog =
    new FotMobFixtureCatalog(
      fotMobClient,
      30_000
    );

  const resolver =
    new FotMobMatchResolver(
      catalog
    );

  const enrichedProvider =
    new FotMobEnrichingFootballProvider(
      oneXBet,
      resolver
    );

  const matches =
    await enrichedProvider
      .getLiveMatches();

  const resolved =
    matches.filter(
      (
        match
      ) =>
        match.sources.some(
          (
            source
          ) =>
            source.provider ===
            "fotmob"
        )
    );

  console.log(
    "\n=========================="
  );

  console.log(
    "1xBet total:",
    matches.length
  );

  console.log(
    "Con coincidencia FotMob:",
    resolved.length
  );

  console.log(
    "Sin FotMob:",
    matches.length -
      resolved.length
  );

  console.log(
    "\nCOINCIDENCIAS:"
  );

  for (
    const match
    of resolved.slice(
      0,
      30
    )
  ) {

    console.log({
      competition:
        match.competition
          .name,

      home:
        match.home.name,

      away:
        match.away.name,

      sources:
        match.sources,
    });
  }
}

void main();
