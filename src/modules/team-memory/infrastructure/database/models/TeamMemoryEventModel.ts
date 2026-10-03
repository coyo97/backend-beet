import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  TeamMemoryOutcome,
} from "../../../domain/entities/TeamMemory";

interface Persistence {
  teamName:
    string;

  teamKey:
    string;

  outcome:
    TeamMemoryOutcome;

  opponentName:
    string | null;

  competitionName:
    string | null;

  kickoffAt:
    Date | null;

  provider:
    string | null;

  externalId:
    string | null;

  note:
    string | null;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type TeamMemoryEventDocument =
  HydratedDocument<
    Persistence
  >;

const schema =
  new Schema<Persistence>(
    {
      teamName: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      teamKey: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      outcome: {
        type:
          String,

        required:
          true,

        enum: [
          "win",
          "loss",
        ],
      },

      opponentName: {
        type:
          String,

        default:
          null,
      },

      competitionName: {
        type:
          String,

        default:
          null,
      },

      kickoffAt: {
        type:
          Date,

        default:
          null,
      },

      provider: {
        type:
          String,

        default:
          null,
      },

      externalId: {
        type:
          String,

        default:
          null,
      },

      note: {
        type:
          String,

        default:
          null,
      },
    },

    {
      collection:
        "team_memory_events",

      timestamps:
        true,
    }
  );

schema.index({
  teamKey:
    1,

  createdAt:
    -1,
});

const existing =
  mongoose.models
    .TeamMemoryEvent as
    | Model<Persistence>
    | undefined;

export const TeamMemoryEventModel =
  existing ??
  mongoose.model<Persistence>(
    "TeamMemoryEvent",
    schema
  );
