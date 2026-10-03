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
  FotMobProvider,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobProvider";

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

  const fotMob =
    new FotMobProvider(
      new FotMobClient()
    );

  const [
    oneXBetResult,
    fotMobResult,
  ] =
    await Promise.allSettled([
      oneXBet
        .getLiveMatches(),

      fotMob
        .getLiveMatches(),
    ]);

  console.log(
    "\n============================"
  );

  console.log(
    "1XBET"
  );

  if (
    oneXBetResult.status ===
    "fulfilled"
  ) {
    console.log(
      "count:",
      oneXBetResult
        .value
        .length
    );

    console.table(
      oneXBetResult
        .value
        .slice(
          0,
          20
        )
        .map(
          (
            match
          ) => ({
            league:
              match
                .competition
                .name,

            country:
              match
                .competition
                .country,

            home:
              match.home.name,

            away:
              match.away.name,

            score:
              `${match.home.goals ?? "-"}-${match.away.goals ?? "-"}`,

            minute:
              match.status
                .minute,

            source:
              match.sources[0]
                ?.externalId,
          })
        )
    );
  } else {
    console.error(
      oneXBetResult
        .reason
    );
  }

  console.log(
    "\n============================"
  );

  console.log(
    "FOTMOB"
  );

  if (
    fotMobResult.status ===
    "fulfilled"
  ) {
    console.log(
      "count:",
      fotMobResult
        .value
        .length
    );

    console.table(
      fotMobResult
        .value
        .slice(
          0,
          20
        )
        .map(
          (
            match
          ) => ({
            league:
              match
                .competition
                .name,

            country:
              match
                .competition
                .country,

            home:
              match.home.name,

            away:
              match.away.name,

            score:
              `${match.home.goals ?? "-"}-${match.away.goals ?? "-"}`,

            minute:
              match.status
                .minute,

            source:
              match.sources[0]
                ?.externalId,
          })
        )
    );
  } else {
    console.error(
      fotMobResult
        .reason
    );
  }
}

void main();
