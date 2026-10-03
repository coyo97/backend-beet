import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  RadarReviewStatus,
} from "../../../domain/entities/RadarReview";

interface Persistence {
  provider:
    string;

  externalId:
    string;

  status:
    RadarReviewStatus;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type RadarReviewDocument =
  HydratedDocument<
    Persistence
  >;

const schema =
  new Schema<Persistence>(
    {
      provider: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      externalId: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      status: {
        type:
          String,

        required:
          true,

        enum: [
          "marked",
          "reviewed",
          "dismissed",
        ],
      },
    },

    {
      collection:
        "radar_reviews",

      timestamps:
        true,
    }
  );

schema.index(
  {
    provider:
      1,

    externalId:
      1,
  },
  {
    unique:
      true,
  }
);

const existing =
  mongoose.models
    .RadarReview as
    | Model<Persistence>
    | undefined;

export const RadarReviewModel =
  existing ??
  mongoose.model<Persistence>(
    "RadarReview",
    schema
  );
