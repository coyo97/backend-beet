import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  PushPlatform,
} from "../../../domain/entities/PushDevice";

export interface PushDevicePersistence {
  expoPushToken:
    string;

  platform:
    PushPlatform;

  active:
    boolean;

  lastSeenAt:
    Date;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type PushDeviceDocument =
  HydratedDocument<
    PushDevicePersistence
  >;

const pushDeviceSchema =
  new Schema<
    PushDevicePersistence
  >(
    {
      expoPushToken: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      platform: {
        type:
          String,

        required:
          true,

        enum: [
          "android",
          "ios",
        ],
      },

      active: {
        type:
          Boolean,

        default:
          true,

        index:
          true,
      },

      lastSeenAt: {
        type:
          Date,

        required:
          true,
      },
    },

    {
      timestamps:
        true,

      collection:
        "push_devices",
    }
  );

const existingModel =
  mongoose.models
    .PushDevice as
    | Model<
        PushDevicePersistence
      >
    | undefined;

export const PushDeviceModel =
  existingModel ??
  mongoose.model<
    PushDevicePersistence
  >(
    "PushDevice",
    pushDeviceSchema
  );
