import {
  FotMobClient,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobClient";

import {
  FotMobRedCardExtractor,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobRedCardExtractor";

import {
  FotMobRedCardProvider,
} from "../../src/modules/football/infrastructure/providers/fotmob/FotMobRedCardProvider";

async function main() {

  const client =
    new FotMobClient();

  const provider =
    new FotMobRedCardProvider(
      client,
      new FotMobRedCardExtractor()
    );

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

  const response =
    await client
      .getMatchesByDate(
        today
      );

  const live =
    response.leagues
      .flatMap(
        (
          league
        ) =>
          league.matches.map(
            (
              match
            ) => ({
              league,
              match,
            })
          )
      )
      .filter(
        (
          item
        ) =>
          item.match
            .status
            .started ===
            true &&
          item.match
            .status
            .finished !==
            true &&
          item.match
            .status
            .cancelled !==
            true
      );

  console.log(
    `Live FotMob: ${live.length}`
  );

  let reds =
    0;

  /*
   * Secuencial deliberadamente.
   *
   * No lanzamos 50 requests
   * simultáneos.
   */
  for (
    const item
    of live
  ) {

    try {
      const snapshot =
        await provider
          .getSnapshot(
            String(
              item.match.id
            )
          );

      if (
        !snapshot.hasRedCard
      ) {
        continue;
      }

      reds +=
        1;

      console.log(
        "\n🔴 RED CARD"
      );

      console.log({
        matchId:
          item.match.id,

        competition:
          item.league.name,

        country:
          item.league.ccode,

        home:
          item.match
            .home
            .name,

        away:
          item.match
            .away
            .name,

        score:
          item.match
            .status
            .scoreStr,

        homeRedCards:
          snapshot
            .homeRedCards,

        awayRedCards:
          snapshot
            .awayRedCards,

        events:
          snapshot
            .events,
      });
    } catch (
      error
    ) {
      console.error(
        "skip:",
        item.match.id
      );
    }
  }

  console.log(
    `\nTotal con roja: ${reds}`
  );
}

void main();
