import {
  SofascoreBrowser,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreBrowser";

import {
  SofascoreStandingsBrowserProvider,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreStandingsBrowserProvider";

const URL =
  "https://www.sofascore.com/es/football/tournament/russia-amateur/championship-sff-sibir/20768#id:90865";

async function main():
  Promise<void> {

  const browser =
    new SofascoreBrowser();

  const provider =
    new SofascoreStandingsBrowserProvider(
      browser
    );

  try {
    const standings =
      await provider
        .getStandings(
          URL
        );

    console.log(
      "\nTOURNAMENT:",
      standings.tournamentName
    );

    console.log(
      "SEASON:",
      standings.seasonName
    );

    console.log(
      "SEASON ID:",
      standings.seasonId
    );

    console.log(
      "\n===== TABLE ====="
    );

    for (
      const row
      of standings.rows
    ) {
      console.log(
        [
          `#${row.position ?? "?"}`,
          row.team.name,
          `PJ=${row.matches ?? "?"}`,
          `G=${row.wins ?? "?"}`,
          `E=${row.draws ?? "?"}`,
          `P=${row.losses ?? "?"}`,
          `GF=${row.scoresFor ?? "?"}`,
          `GC=${row.scoresAgainst ?? "?"}`,
          `PTS=${row.points ?? "?"}`,
        ].join(
          " | "
        )
      );
    }
  } finally {
    await browser.stop();
  }
}

void main();
