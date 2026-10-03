import {
  LowerLeagueArchiveRecentFormClient,
} from "../src/modules/match-context/infrastructure/lower-league-archive/LowerLeagueArchiveRecentFormClient";

async function main():
  Promise<void> {

  const client =
    new LowerLeagueArchiveRecentFormClient();

  const teams = [
    {
      id:
        "71",

      name:
        "Guangdong Chenxing Juli",
    },

    {
      id:
        "28",

      name:
        "Wuhan Lianzhen FC",
    },
  ];

  for (
    const team
    of teams
  ) {

    const matches =
      await client
        .getRecentMatches(
          team
        );

    console.log(
      "\n=============================="
    );

    console.log(
      team.name
    );

    console.log(
      "FORM:",
      matches.map(
        (
          item
        ) =>
          item.result
      )
    );

    console.dir(
      matches,
      {
        depth:
          null,
      }
    );
  }
}

void main();
