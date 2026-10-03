import type {
  CreatePendingPushReceiptInput,
  PushReceipt,
} from "../../domain/entities/PushReceipt";

import type {
  PushReceiptRepository,
} from "../../domain/repositories/PushReceiptRepository";

import {
  PushReceiptModel,
  type PushReceiptDocument,
} from "../database/models/PushReceiptModel";

export class MongoosePushReceiptRepository
  implements PushReceiptRepository
{
  public async createPending(
    input:
      CreatePendingPushReceiptInput
  ): Promise<void> {

    await PushReceiptModel
      .updateOne(
        {
          receiptId:
            input.receiptId,
        },

        {
          $setOnInsert: {
            receiptId:
              input.receiptId,

            expoPushToken:
              input.expoPushToken,

            status:
              "pending",

            errorCode:
              null,

            errorMessage:
              null,

            sentAt:
              input.sentAt,

            nextCheckAt:
              input.nextCheckAt,

            checkedAt:
              null,

            attempts:
              0,
          },
        },

        {
          upsert:
            true,
        }
      )
      .exec();
  }

  public async findReady(
    now:
      Date,

    limit:
      number
  ): Promise<
    PushReceipt[]
  > {

    const documents =
      await PushReceiptModel
        .find({
          status:
            "pending",

          nextCheckAt: {
            $lte:
              now,
          },
        })
        .sort({
          nextCheckAt:
            1,
        })
        .limit(
          limit
        )
        .exec();

    return documents.map(
      (
        document
      ) =>
        this.toDomain(
          document
        )
    );
  }

  public async markDelivered(
    receiptId:
      string,

    checkedAt:
      Date
  ): Promise<void> {

    await PushReceiptModel
      .updateOne(
        {
          receiptId,
        },

        {
          $set: {
            status:
              "delivered",

            checkedAt,

            errorCode:
              null,

            errorMessage:
              null,
          },

          $inc: {
            attempts:
              1,
          },
        }
      )
      .exec();
  }

  public async markError(
    receiptId:
      string,

    errorCode:
      string | null,

    errorMessage:
      string | null,

    checkedAt:
      Date
  ): Promise<void> {

    await PushReceiptModel
      .updateOne(
        {
          receiptId,
        },

        {
          $set: {
            status:
              "error",

            errorCode,

            errorMessage,

            checkedAt,
          },

          $inc: {
            attempts:
              1,
          },
        }
      )
      .exec();
  }

  public async reschedule(
    receiptId:
      string,

    nextCheckAt:
      Date,

    checkedAt:
      Date
  ): Promise<void> {

    await PushReceiptModel
      .updateOne(
        {
          receiptId,
        },

        {
          $set: {
            nextCheckAt,

            checkedAt,
          },

          $inc: {
            attempts:
              1,
          },
        }
      )
      .exec();
  }

  public async markExpired(
    receiptId:
      string,

    checkedAt:
      Date
  ): Promise<void> {

    await PushReceiptModel
      .updateOne(
        {
          receiptId,
        },

        {
          $set: {
            status:
              "expired",

            checkedAt,

            errorMessage:
              "Expo receipt unavailable after 24 hours",
          },

          $inc: {
            attempts:
              1,
          },
        }
      )
      .exec();
  }

  private toDomain(
    document:
      PushReceiptDocument
  ): PushReceipt {

    return {
      id:
        String(
          document._id
        ),

      receiptId:
        document.receiptId,

      expoPushToken:
        document.expoPushToken,

      status:
        document.status,

      errorCode:
        document.errorCode,

      errorMessage:
        document.errorMessage,

      sentAt:
        document.sentAt,

      nextCheckAt:
        document.nextCheckAt,

      checkedAt:
        document.checkedAt,

      attempts:
        document.attempts,

      createdAt:
        document.createdAt,

      updatedAt:
        document.updatedAt,
    };
  }
}
