import type {
  FootballProviderKey,
  StoredFootballProviderSetting,
} from "../../domain/entities/FootballProviderSetting";

import type {
  FootballProviderSettingsRepository,
} from "../../domain/repositories/FootballProviderSettingsRepository";

import {
  FootballProviderSettingModel,
  type FootballProviderSettingDocument,
} from "../database/models/FootballProviderSettingModel";

export class MongooseFootballProviderSettingsRepository
  implements FootballProviderSettingsRepository
{
  public async findAll():
    Promise<
      StoredFootballProviderSetting[]
    > {

    const documents =
      await FootballProviderSettingModel
        .find()
        .exec();

    return documents.map(
      document =>
        this.toDomain(
          document
        )
    );
  }

  public async upsert(
    key:
      FootballProviderKey,

    enabled:
      boolean
  ): Promise<
    StoredFootballProviderSetting
  > {

    const document =
      await FootballProviderSettingModel
        .findOneAndUpdate(
          {
            key,
          },

          {
            $set: {
              enabled,
            },

            $setOnInsert: {
              key,
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

  private toDomain(
    document:
      FootballProviderSettingDocument
  ): StoredFootballProviderSetting {

    return {
      key:
        document.key,

      enabled:
        document.enabled,

      createdAt:
        document.createdAt
          .toISOString(),

      updatedAt:
        document.updatedAt
          .toISOString(),
    };
  }
}
