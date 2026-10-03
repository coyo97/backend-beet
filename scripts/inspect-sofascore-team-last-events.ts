import {
  SofascoreSessionClient,
} from "../src/modules/football/infrastructure/providers/sofascore-browser/SofascoreSessionClient";

const teams = [
  {
    id:
      251605,

    name:
      "Enisey Krasnoyarsk",
  },
  {
    id:
      283393,

    name:
      "Lokomotiv Moscow",
  },
];

async function main():
  Promise<void> {

  const client =
    new SofascoreSessionClient();

  try {

    for (
      const team
      of teams
    ) {

      const events =
        await client
          .getTeamLastEvents(
            team.id
          );

      console.log(
        "\n================================"
      );

      console.log(
        team.name
      );

      console.log(
        "TEAM ID:",
        team.id
      );

      console.log(
        "EVENTS:",
        events.length
      );

      for (
        const event
        of events.slice(
          0,
          5
        )
      ) {

        console.log({
          id:
            event.id,

          date:
            typeof event
              .startTimestamp ===
              "number"
              ? new Date(
                  event.startTimestamp *
                    1000
                )
                  .toISOString()
              : null,

          home:
            event.homeTeam
              ?.name,

          away:
            event.awayTeam
              ?.name,

          homeId:
            event.homeTeam
              ?.id,

          awayId:
            event.awayTeam
              ?.id,

          homeGoals:
            event.homeScore
              ?.current,

          awayGoals:
            event.awayScore
              ?.current,

          status:
            event.status,

          tournament:
            event.tournament
              ?.name,
        });
      }
    }
  } finally {

    await client.stop();
  }
}

void main();
