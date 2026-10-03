import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  PushReceiptStatus,
} from "../../../domain/entities/PushReceipt";

export interface PushReceiptPersistence {
  receiptId:
    string;

  expoPushToken:
    string;

  status:
    PushReceiptStatus;

  errorCode:
    string | null;

  errorMessage:
    string | null;

  sentAt:
    Date;

  nextCheckAt:
    Date;

  checkedAt:
    Date | null;

  attempts:
    number;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type PushReceiptDocument =
  HydratedDocument<
    PushReceiptPersistence
  >;

const pushReceiptSchema =
  new Schema<
    PushReceiptPersistence
  >(
    {
      receiptId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      expoPushToken: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      status: {
        type:
          String,

        required:
          true,

        enum: [
          "pending",
          "delivered",
          "error",
          "expired",
        ],

        default:
          "pending",

        index:
          true,
      },

      errorCode: {
        type:
          String,

        default:
          null,
      },

      errorMessage: {
        type:
          String,

        default:
          null,
      },

      sentAt: {
        type:
          Date,

        required:
          true,
      },

      nextCheckAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      checkedAt: {
        type:
          Date,

        default:
          null,
      },

      attempts: {
        type:
          Number,

        default:
          0,
      },
    },

    {
      timestamps:
        true,

      collection:
        "push_receipts",
    }
  );

pushReceiptSchema.index({
  status:
    1,

  nextCheckAt:
    1,
});

const existingModel =
  mongoose.models
    .PushReceipt as
    | Model<
        PushReceiptPersistence
      >
    | undefined;

export const PushReceiptModel =
  existingModel ??
  mongoose.model<
    PushReceiptPersistence
  >(
    "PushReceipt",
    pushReceiptSchema
  );;
