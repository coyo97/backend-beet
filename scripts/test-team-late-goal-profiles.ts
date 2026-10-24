import mongoose from "mongoose";

import type {
  MatchEventSnapshot,
} from "../src/modules/football/domain/entities/MatchEventSnapshot";

import {
  TeamLateGoalProfileAnalyzer,
} from "../src/modules/football/domain/services/TeamLateGoalProfileAnalyzer";

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

  const documents =
    await mongoose
      .connection
      .db
      .collection(
        "match_event_snapshots"
      )
      .find({})
      .sort({
        kickoffAt:
          -1,
      })
      .limit(
        500
      )
      .toArray();

  const snapshots =
    documents as unknown as
      MatchEventSnapshot[];

  const teamNames =
    new Set<
      string
    >();

  for (
    const snapshot
    of snapshots
  ) {
    teamNames.add(
      snapshot.home.name
    );

    teamNames.add(
      snapshot.away.name
    );
  }

  const analyzer =
    new TeamLateGoalProfileAnalyzer();

  for (
    const teamName
    of Array.from(
      teamNames
    ).sort()
  ) {

    const profile =
      analyzer.analyze(
        teamName,
        snapshots
      );

    console.log(
      "\n=============================="
    );

    console.log(
      teamName
    );

    console.log({
      matchesTracked:
        profile.matchesTracked,

      matchesObserved80:
        profile.matchesObserved80,

      matchesObserved90:
        profile.matchesObserved90,

      recordedGoalsScored:
        profile.recordedGoalsScored,

      recordedGoalsConceded:
        profile.recordedGoalsConceded,

      late80Scored:
        profile.late80Scored,

      late80Conceded:
        profile.late80Conceded,

      late90Scored:
        profile.late90Scored,

      late90Conceded:
        profile.late90Conceded,

      late80ScoringMatchRate:
        profile
          .late80ScoringMatchRate,

      late80ConcedingMatchRate:
        profile
          .late80ConcedingMatchRate,

      scorers:
        profile.scorers,
    });
  }

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
