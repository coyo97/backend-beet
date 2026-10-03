import {
  SofascoreSessionClient,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreSessionClient";

import {
  SofascoreLiveProvider,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreLiveProvider";

async function main():
  Promise<void> {

  const client =
    new SofascoreSessionClient();

  const provider =
    new SofascoreLiveProvider(
      client
    );

  try {
    const matches =
      await provider
        .getLiveMatches();

    console.log(
      "SOFASCORE MATCHES:",
      matches.length
    );

    console.dir(
      matches.map(
        match => ({
          home:
            match.home.name,

          away:
            match.away.name,

          score:
            `${match.home.goals ?? "?"}-${match.away.goals ?? "?"}`,

          competition:
            match.competition.name,

          status:
            match.status,

          sources:
            match.sources,
        })
      ),
      {
        depth:
          null,
      }
    );
  } finally {
    await client.stop();
  }
}

void main();
