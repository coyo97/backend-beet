import {
  FlashscoreMatchLineupProvider,
} from "../src/modules/team-lineup/infrastructure/providers/flashscore/FlashscoreMatchLineupProvider";

async function main() {

  const externalId =
    process.argv[2];

  if (!externalId) {
    throw new Error(
      "Usage: npx tsx scripts/test-team-lineup-provider.ts MATCH_ID"
    );
  }

  const provider =
    new FlashscoreMatchLineupProvider();

  const lineup =
    await provider
      .getLineup(
        "flashscore",
        externalId
      );

  console.log(
    JSON.stringify(
      {
        provider:
          lineup.provider,

        externalId:
          lineup.externalId,

        kickoffAt:
          lineup.kickoffAt,

        status:
          lineup.status,

        home: {
          teamId:
            lineup.home
              .teamId,

          teamName:
            lineup.home
              .teamName,

          starters:
            lineup.home
              .starters,

          startersCount:
            lineup.home
              .starters
              .length,

          substitutesCount:
            lineup.home
              .substitutes
              .length,
        },

        away: {
          teamId:
            lineup.away
              .teamId,

          teamName:
            lineup.away
              .teamName,

          starters:
            lineup.away
              .starters,

          startersCount:
            lineup.away
              .starters
              .length,

          substitutesCount:
            lineup.away
              .substitutes
              .length,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch(
    error => {

      console.error(
        error
      );

      process.exitCode =
        1;
    }
  );
