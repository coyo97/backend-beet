import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import {
  FOOTBALL_PROVIDER_KEYS,
  type FootballProviderKey,
} from "../../../domain/entities/FootballProviderSetting";

interface Persistence {
  key:
    FootballProviderKey;

  enabled:
    boolean;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type FootballProviderSettingDocument =
  HydratedDocument<
    Persistence
  >;

const schema =
  new Schema<Persistence>(
    {
      key: {
        type:
          String,

        required:
          true,

        unique:
          true,

        enum:
          FOOTBALL_PROVIDER_KEYS,
      },

      enabled: {
        type:
          Boolean,

        required:
          true,
      },
    },

    {
      collection:
        "football_provider_settings",

      timestamps:
        true,
    }
  );

const existing =
  mongoose.models
    .FootballProviderSetting as
    | Model<Persistence>
    | undefined;

export const FootballProviderSettingModel =
  existing ??
  mongoose.model<Persistence>(
    "FootballProviderSetting",
    schema
  );
