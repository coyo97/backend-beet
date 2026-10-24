import mongoose from "mongoose";

import {
  getLateGoalProfilesForTeams,
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

  await mongoose.connect(
    uri
  );

  const profiles =
    await getLateGoalProfilesForTeams
      .execute(
        [
          "Viborg",
          "FC Midtjylland",
          "Degerfors IF",
          "Kalmar FF",
          "Australia U17 W",
          "Chile U17 W",
        ],
        50
      );

  console.dir(
    profiles,
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
