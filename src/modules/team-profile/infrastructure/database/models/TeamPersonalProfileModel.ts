import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  TeamPersonalLabel,
} from "../../../domain/entities/TeamPersonalProfile";

interface Persistence {
  ownerId:
    string;

  teamName:
    string;

  teamKey:
    string;

  label:
    TeamPersonalLabel |
    null;

  note:
    string | null;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type TeamPersonalProfileDocument =
  HydratedDocument<
    Persistence
  >;

const schema =
  new Schema<Persistence>(
    {
      ownerId: {
        type:
          String,

        required:
          true,

        trim:
          true,

        index:
          true,
      },

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

        trim:
          true,
      },

      label: {
        type:
          String,

        enum: [
          "avoid",
          "watch",
          "trusted",
          null,
        ],

        default:
          null,
      },

      note: {
        type:
          String,

        default:
          null,

        maxlength:
          500,
      },
    },

    {
      collection:
        "team_personal_profiles",

      timestamps:
        true,
    }
  );

schema.index(
  {
    ownerId:
      1,

    teamKey:
      1,
  },
  {
    unique:
      true,
  }
);

const existing =
  mongoose.models
    .TeamPersonalProfile as
    | Model<Persistence>
    | undefined;

export const TeamPersonalProfileModel =
  existing ??
  mongoose.model<Persistence>(
    "TeamPersonalProfile",
    schema
  );
