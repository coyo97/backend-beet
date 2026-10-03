import {
  CompetitionExternalSourceRegistry,
} from "../src/modules/match-context/infrastructure/external-sources/CompetitionExternalSourceRegistry";

const registry =
  new CompetitionExternalSourceRegistry();

const tests = [
  {
    name:
      "Championship SFF Sibir Gold",

    country:
      "Russia",
  },

  {
    name:
      "Championship SFF Sibir",

    country:
      "Russia",
  },

  {
    name:
      "Russian Championship. National Student Football League",

    country:
      "Russia",
  },

  {
    name:
      "Bolivia Primera Division",

    country:
      "Bolivia",
  },
];

for (
  const test
  of tests
) {
  const source =
    registry.find(
      test.name,
      test.country
    );

  console.log(
    "\nCOMPETITION:",
    test.name
  );

  console.log(
    "SOURCE:",
    source
      ? {
          provider:
            source.provider,

          canonicalName:
            source.canonicalName,

          tournamentId:
            source.tournamentId,

          seasonId:
            source.seasonId,
        }
      : null
  );
}
