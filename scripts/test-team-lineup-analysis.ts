import "dotenv/config";

import mongoose from "mongoose";

import {
  MongooseMatchLineupStore,
} from "../src/modules/team-lineup/infrastructure/repositories/MongooseMatchLineupStore";

import {
  AnalyzeMatchLineup,
} from "../src/modules/team-lineup/application/use-cases/AnalyzeMatchLineup";

async function main() {

  const externalId =
    process.argv[2];

  if (!externalId) {
    throw new Error(
      "Usage: npx tsx scripts/test-team-lineup-analysis.ts MATCH_ID"
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

  const store =
    new MongooseMatchLineupStore();

  const sourceKey =
    `flashscore:${externalId}`;

  const lineup =
    await store
      .findBySourceKey(
        sourceKey
      );

  if (!lineup) {
    throw new Error(
      `Lineup not found: ${sourceKey}`
    );
  }

  const analyze =
    new AnalyzeMatchLineup(
      store
    );

  const analysis =
    await analyze
      .execute({
        lineup,
        historyLimit:
          8,
      });

  console.log(
    JSON.stringify(
      analysis,
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
