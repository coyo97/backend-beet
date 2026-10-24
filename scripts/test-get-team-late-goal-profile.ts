import mongoose from "mongoose";

import {
  getTeamLateGoalProfile,
} from "../src/modules/football/footballModule";

async function main():
  Promise<void> {

  const uri =
    process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is required"
    );
  }

  const teamName =
    process.argv
      .slice(
        2
      )
      .join(
        " "
      )
      .trim();

  if (!teamName) {
    throw new Error(
      "Usage: script <team name>"
    );
  }

  await mongoose.connect(
    uri
  );

  const profile =
    await getTeamLateGoalProfile
      .execute(
        teamName,
        50
      );

  console.dir(
    profile,
    {
      depth:
        null,
    }
  );

  await mongoose.disconnect();
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

      process.exit(
        1
      );
    }
  );
