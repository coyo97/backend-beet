import {
  getRedCardMatches,
  getLiveMatches,
} from "../../src/modules/football/footballModule";

import {
  supplementalRedCardsModule,
} from "../../src/modules/radar/radarModule";

import {
  GetUnifiedRedCardMatchesForSignals,
} from "../../src/modules/radar/application/use-cases/GetUnifiedRedCardMatchesForSignals";

async function main() {

  const useCase =
    new GetUnifiedRedCardMatchesForSignals(
      getRedCardMatches as any,
      getLiveMatches,
      supplementalRedCardsModule
        .aggregator
    );

  const matches =
    await useCase
      .execute();

  console.log(
    "ROJAS UNIFICADAS:",
    matches.length
  );

  for (
    const item
    of matches
  ) {

    console.log({
      match:
        `${item.match.home.name} vs ${item.match.away.name}`,

      competition:
        item.match
          .competition
          .name,

      redCards:
        item.redCards,

      sources:
        item.match.sources.map(
          (
            source
          ) =>
            source.provider
        ),
    });
  }
}

void main();
