import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  PushMinimumStrength,
  PushWatchlistTypes,
} from "../../../domain/entities/PushPreferences";

export interface PushPreferencesPersistence {
  key:
    string;

  enabled:
    boolean;

  minimumStrength:
    PushMinimumStrength;

  watchlistTypes:
    PushWatchlistTypes;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type PushPreferencesDocument =
  HydratedDocument<
    PushPreferencesPersistence
  >;

const schema =
  new Schema<
    PushPreferencesPersistence
  >(
    {
      key: {
        type:
          String,

        required:
          true,

        unique:
          true,
      },

      enabled: {
        type:
          Boolean,

        default:
          true,
      },

      minimumStrength: {
        type:
          String,

        enum: [
          "clear",
          "strong",
        ],

        default:
          "clear",
      },

      watchlistTypes: {
        match: {
          type:
            Boolean,

          default:
            true,
        },

        team: {
          type:
            Boolean,

          default:
            true,
        },

        competition: {
          type:
            Boolean,

          default:
            true,
        },

        country: {
          type:
            Boolean,

          default:
            true,
        },

        radarRule: {
          type:
            Boolean,

          default:
            true,
        },
      },
    },

    {
      timestamps:
        true,

      collection:
        "push_preferences",
    }
  );

const existing =
  mongoose.models
    .PushPreferences as
    | Model<
        PushPreferencesPersistence
      >
    | undefined;

export const PushPreferencesModel =
  existing ??
  mongoose.model<
    PushPreferencesPersistence
  >(
    "PushPreferences",
    schema
  );
