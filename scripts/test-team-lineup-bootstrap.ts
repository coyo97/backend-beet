import "dotenv/config";

import mongoose from "mongoose";

import {
  FlashscoreTeamMatchHistoryCatalog,
} from "../src/modules/team-lineup/infrastructure/catalogs/flashscore/FlashscoreTeamMatchHistoryCatalog";

import {
  FlashscoreMatchLineupProvider,
} from "../src/modules/team-lineup/infrastructure/providers/flashscore/FlashscoreMatchLineupProvider";

import {
  MongooseMatchLineupStore,
} from "../src/modules/team-lineup/infrastructure/repositories/MongooseMatchLineupStore";

import {
  BootstrapTeamLineupHistory,
} from "../src/modules/team-lineup/application/use-cases/BootstrapTeamLineupHistory";

async function main() {

  const teamId =
    process.argv[2];

  const currentMatchId =
    process.argv[3];

  const rawLimit =
    Number(
      process.argv[4] ??
      5
    );

  if (!teamId) {
    throw new Error(
      "Usage: npx tsx scripts/test-team-lineup-bootstrap.ts TEAM_ID [CURRENT_MATCH_ID] [LIMIT]"
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

  const catalog =
    new FlashscoreTeamMatchHistoryCatalog();

  const provider =
    new FlashscoreMatchLineupProvider();

  const store =
    new MongooseMatchLineupStore();

  const bootstrap =
    new BootstrapTeamLineupHistory(
      catalog,
      provider,
      store
    );

  const result =
    await bootstrap
      .execute({
        provider:
          "flashscore",

        teamId,

        limit:
          rawLimit,

        excludeSourceKey:
          currentMatchId
            ? `flashscore:${currentMatchId}`
            : undefined,
      });

  console.log(
    JSON.stringify(
      result,
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
