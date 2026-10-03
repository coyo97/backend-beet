import type {
  RadarReview,
  SetRadarReviewInput,
} from "../../domain/entities/RadarReview";

import type {
  RadarReviewRepository,
} from "../../domain/repositories/RadarReviewRepository";

import {
  RadarReviewModel,
  type RadarReviewDocument,
} from "../database/models/RadarReviewModel";

export class MongooseRadarReviewRepository
  implements RadarReviewRepository
{
  public async findAll():
    Promise<
      RadarReview[]
    > {

    const documents =
      await RadarReviewModel
        .find()
        .sort({
          updatedAt:
            -1,
        })
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

  public async upsert(
    input:
      SetRadarReviewInput
  ): Promise<
    RadarReview
  > {

    const document =
      await RadarReviewModel
        .findOneAndUpdate(
          {
            provider:
              input.provider,

            externalId:
              input.externalId,
          },

          {
            $set: {
              status:
                input.status,
            },

            $setOnInsert: {
              provider:
                input.provider,

              externalId:
                input.externalId,
            },
          },

          {
            new:
              true,

            upsert:
              true,

            setDefaultsOnInsert:
              true,
          }
        )
        .exec();

    return this.toDomain(
      document
    );
  }

  public async delete(
    provider:
      string,

    externalId:
      string
  ): Promise<void> {

    await RadarReviewModel
      .deleteOne({
        provider,
        externalId,
      })
      .exec();
  }

  private toDomain(
    document:
      RadarReviewDocument
  ): RadarReview {

    return {
      id:
        String(
          document._id
        ),

      provider:
        document.provider,

      externalId:
        document.externalId,

      status:
        document.status,

      createdAt:
        document.createdAt
          .toISOString(),

      updatedAt:
        document.updatedAt
          .toISOString(),
    };
  }
}
