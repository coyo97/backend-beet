import type {
  PushPreferences,
  UpdatePushPreferencesInput,
} from "../../domain/entities/PushPreferences";

import type {
  PushPreferencesRepository,
} from "../../domain/repositories/PushPreferencesRepository";

import {
  PushPreferencesModel,
  type PushPreferencesDocument,
} from "../database/models/PushPreferencesModel";

export class MongoosePushPreferencesRepository
  implements PushPreferencesRepository
{
  private readonly key =
    "default";

  public async get():
    Promise<
      PushPreferences
    > {

    const document =
      await PushPreferencesModel
        .findOneAndUpdate(
          {
            key:
              this.key,
          },

          {
            $setOnInsert: {
              key:
                this.key,

              enabled:
                true,

              minimumStrength:
                "clear",

              watchlistTypes: {
                match:
                  true,

                team:
                  true,

                competition:
                  true,

                country:
                  true,

                radarRule:
                  true,
              },
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

  public async update(
    input:
      UpdatePushPreferencesInput
  ): Promise<
    PushPreferences
  > {

    const current =
      await this.get();

    const watchlistTypes = {
      ...current
        .watchlistTypes,

      ...input
        .watchlistTypes,
    };

    const document =
      await PushPreferencesModel
        .findOneAndUpdate(
          {
            key:
              this.key,
          },

          {
            $set: {
              enabled:
                input.enabled ??
                current.enabled,

              minimumStrength:
                input
                  .minimumStrength ??
                current
                  .minimumStrength,

              watchlistTypes,
            },
          },

          {
            new:
              true,
          }
        )
        .exec();

		if (!document) {
  throw new Error(
    "Push preferences document could not be updated"
  );
}

    return this.toDomain(
      document
    );
  }

  private toDomain(
    document:
      PushPreferencesDocument
  ): PushPreferences {

    return {
      enabled:
        document.enabled,

      minimumStrength:
        document
          .minimumStrength,

      watchlistTypes: {
        match:
          document
            .watchlistTypes
            .match,

        team:
          document
            .watchlistTypes
            .team,

        competition:
          document
            .watchlistTypes
            .competition,

        country:
          document
            .watchlistTypes
            .country,

        radarRule:
          document
            .watchlistTypes
            .radarRule,
      },

      updatedAt:
        document.updatedAt
          .toISOString(),
    };
  }
}
