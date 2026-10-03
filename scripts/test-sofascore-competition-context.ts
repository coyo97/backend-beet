import {
  CompetitionExternalSourceRegistry,
} from "../src/modules/match-context/infrastructure/external-sources/CompetitionExternalSourceRegistry";

import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

import {
  SofascoreStandingsBrowserProvider,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreStandingsBrowserProvider";

import {
  SofascoreCompetitionContextResolver,
} from "../src/modules/match-context/infrastructure/sofascore/SofascoreCompetitionContextResolver";

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  const registry =
    new CompetitionExternalSourceRegistry();

  const standingsProvider =
    new SofascoreStandingsBrowserProvider(
      browser
    );

  const resolver =
    new SofascoreCompetitionContextResolver(
      registry,
      standingsProvider
    );

  try {
    const context =
      await resolver.resolve({
        source: {
          provider:
            "bookmaker",

          externalId:
            "test-match",
        },

        competitionName:
          "Championship SFF Sibir Gold",

        country:
          "Russia",

        homeName:
          "Temp Barnaul",

        awayName:
          "Buryatia Ulan-Ude",
      });

    console.dir(
      context,
      {
        depth:
          null,
      }
    );
  } finally {
    await browser.stop();
  }
}

void main();
