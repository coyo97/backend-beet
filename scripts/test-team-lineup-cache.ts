import "dotenv/config";

import mongoose from "mongoose";

import {
  FlashscoreMatchLineupProvider,
} from "../src/modules/team-lineup/infrastructure/providers/flashscore/FlashscoreMatchLineupProvider";

import {
  MongooseMatchLineupStore,
} from "../src/modules/team-lineup/infrastructure/repositories/MongooseMatchLineupStore";

import {
  VerifyMatchLineup,
} from "../src/modules/team-lineup/application/use-cases/VerifyMatchLineup";

async function main() {

  const externalId =
    process.argv[2];

  if (!externalId) {
    throw new Error(
      "Usage: npx tsx scripts/test-team-lineup-cache.ts MATCH_ID"
    );
  }

  if (
    !process.env
      .MONGODB_URI
  ) {
    throw new Error(
      "MONGODB_URI is required"
    );
  }

  await mongoose.connect(
    process.env
      .MONGODB_URI
  );

  console.log(
    "MongoDB connected"
  );

  const provider =
    new FlashscoreMatchLineupProvider();

  const store =
    new MongooseMatchLineupStore();

  const verify =
    new VerifyMatchLineup(
      provider,
      store
    );

  const result =
    await verify.execute({
      provider:
        "flashscore",

      externalId,
    });

  console.log(
    JSON.stringify(
      {
        source:
          result.source,

        status:
          result.lineup
            .status,

        sourceKey:
          result.lineup
            .sourceKey,

        kickoffAt:
          result.lineup
            .kickoffAt,

        home: {
          teamId:
            result.lineup
              .home
              .teamId,

          teamName:
            result.lineup
              .home
              .teamName,

          starters:
            result.lineup
              .home
              .starters
              .length,
        },

        away: {
          teamId:
            result.lineup
              .away
              .teamId,

          teamName:
            result.lineup
              .away
              .teamName,

          starters:
            result.lineup
              .away
              .starters
              .length,
        },
      },
      null,
      2
    )
  );

  await mongoose
    .disconnect();
}

main()
  .catch(
    async error => {

      console.error(
        error
      );

      await mongoose
        .disconnect()
        .catch(
          () => undefined
        );

      process.exitCode =
        1;
    }
  );
