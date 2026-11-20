import "dotenv/config";

import {
  OneXBetPrematchClient,
} from "../src/modules/football/infrastructure/providers/onexbet/OneXBetPrematchClient";

async function main(): Promise<void> {
  const slug =
    process.argv[2] ??
    "1268397-brazil-campeonato-brasileiro-serie-a";

  const client =
    new OneXBetPrematchClient();

  console.log(
    "\n========== PRIMERA CONSULTA =========="
  );

  const first =
    await client.getCompetition(slug);

  console.log({
    competition: first.competitionSlug,
    count: first.games.length,
    fetchedAt: first.fetchedAt,
    stale: first.stale,
  });

  for (const game of first.games) {
    console.log({
      home: game.homeName,
      away: game.awayName,
      kickoffAt: game.kickoffAt,
      url: client.buildMatchUrl(game),
    });
  }

  console.log(
    "\n========== SEGUNDA CONSULTA =========="
  );

  const second =
    await client.getCompetition(slug);

  console.log({
    count: second.games.length,
    fetchedAt: second.fetchedAt,
    stale: second.stale,
    sameSnapshot:
      first.fetchedAt === second.fetchedAt,
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
