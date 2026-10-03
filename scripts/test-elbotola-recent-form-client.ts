import {
  ElbotolaRecentFormClient,
} from "../src/modules/match-context/infrastructure/elbotola/ElbotolaRecentFormClient";

async function main():
  Promise<void> {

  const client =
    new ElbotolaRecentFormClient();

  const teams = [
    {
      id:
        "8yomo4h0nejq0j6",

      name:
        "Wuhan Lianzhen",
    },

    {
      id:
        "pxwrxlhvw1vryk0",

      name:
        "Guangdong Chenxingjuli",
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
      "COUNT:",
      matches.length
    );

    console.dir(
      matches,
      {
        depth:
          null,
      }
    );

    console.log(
      "FORM:",
      matches.map(
        (
          match
        ) =>
          match.result
      )
    );
  }
}

void main();
