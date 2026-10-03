import {
  FotMobClient,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobMatchContextProvider,
} from "../../src/modules/match-context/infrastructure/fotmob/FotMobMatchContextProvider";

async function main() {

  const client =
    new FotMobClient();

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      )
      .replace(
        /-/g,
        ""
      );

  const matches =
    await client
      .getMatchesByDate(
        today
      );

  const all =
    matches.leagues
      .flatMap(
        (
          league
        ) =>
          league.matches
      );

  const candidate =
    all.find(
      (
        match
      ) =>
        match.status.started
    ) ??
    all[0];

  if (!candidate) {
    console.log(
      "No FotMob matches found."
    );

    return;
  }

  console.log(
    "Testing match:",
    candidate.id,

    candidate.home.name,
    "vs",
    candidate.away.name
  );

  const provider =
    new FotMobMatchContextProvider(
      client
    );

  const context =
    await provider
      .getMatchContext({
        provider:
          "fotmob",

        externalId:
          String(
            candidate.id
          ),
      });

  console.dir(
    context,
    {
      depth:
        null,
    }
  );
}

void main();
