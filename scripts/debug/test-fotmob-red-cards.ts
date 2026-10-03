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

  const extractor =
    new FotMobRedCardExtractor();

  const provider =
    new FotMobRedCardProvider(
      client,
      extractor
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

  const day =
    await client
      .getMatchesByDate(
        today
      );

  const all =
    day.leagues
      .flatMap(
        (
          league
        ) =>
          league.matches
            .map(
              (
                match
              ) => ({
                league:
                  league.name,

                match,
              })
            )
      );

  const live =
    all.filter(
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
    "FotMob live:",
    live.length
  );

  /*
   * Evitamos bombardear FotMob.
   * Probamos máximo 10 partidos.
   */
  const candidates =
    live.slice(
      0,
      10
    );

  for (
    const item
    of candidates
  ) {

    try {
      const snapshot =
        await provider
          .getSnapshot(
            String(
              item.match.id
            )
          );

      console.log({
        matchId:
          item.match.id,

        league:
          item.league,

        match:
          `${item.match.home.name} vs ${item.match.away.name}`,

        score:
          item.match.status
            .scoreStr,

        homeRedCards:
          snapshot
            .homeRedCards,

        awayRedCards:
          snapshot
            .awayRedCards,

        hasRedCard:
          snapshot
            .hasRedCard,

        confidence:
          snapshot
            .confidence,

        events:
          snapshot
            .events,
      });
    } catch (
      error
    ) {
      console.error(
        "FotMob red-card error",
        item.match.id,
        error
      );
    }
  }
}

void main();
