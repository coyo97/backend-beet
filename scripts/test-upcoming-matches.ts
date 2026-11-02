
import "dotenv/config";

import {
  FlashscoreUpcomingMatchesProvider,
} from "../src/modules/football/infrastructure/providers/flashscore/FlashscoreUpcomingMatchesProvider";

import {
  GetUpcomingMatches,
} from "../src/modules/football/application/use-cases/GetUpcomingMatches";

async function main() {

  const provider =
    new FlashscoreUpcomingMatchesProvider();

  const useCase =
    new GetUpcomingMatches(provider);

  const matches =
    await useCase.execute({
      hours: 48,
      limit: 5000,
    });

  console.log(
    "\n===== PRÓXIMOS PARTIDOS ====="
  );

  console.log(
    "Total en próximas 48 h:",
    matches.length
  );

  const competitions =
    new Map<string, number>();

  for (const match of matches) {

    const key =
      [
        match.competition.country,
        match.competition.name,
      ].join(" / ");

    competitions.set(
      key,
      (competitions.get(key) ?? 0) + 1
    );
  }

  console.log(
    "\n===== COMPETICIONES ====="
  );

  console.table(
    [...competitions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([competition, total]) => ({
        competition,
        total,
      }))
  );

  console.log(
    "\n===== PRIMEROS 20 ENCUENTROS ====="
  );

  console.table(
    matches.slice(0, 20).map(
      match => ({
        kickoffAt:
          match.kickoffAt,

        home:
          match.home.name,

        away:
          match.away.name,

        competition:
          match.competition.name,

        provider:
          match.sources[0]?.provider,

        externalId:
          match.sources[0]?.externalId,
      })
    )
  );

  const invalid =
    matches.filter(
      match =>
        match.status.short !== "NS" ||
        !match.sources[0]?.externalId
    );

  if (invalid.length > 0) {
    throw new Error(
      `${invalid.length} encuentros inválidos`
    );
  }

  console.log(
    "\nOK: encuentros futuros normalizados"
  );
}

void main().catch(error => {
  console.error(
    "[UpcomingMatchesTest]",
    error
  );

  process.exitCode = 1;
});

