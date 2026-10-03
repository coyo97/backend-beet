import type {
  WatchlistItem,
} from "../../domain/entities/WatchlistItem";

import type {
  CreateWatchlistRecord,
  WatchlistRepository,
} from "../../domain/repositories/WatchlistRepository";

import {
  WatchlistItemModel,
  type WatchlistItemDocument,
} from "../database/models/WatchlistItemModel";

export class MongooseWatchlistRepository
  implements WatchlistRepository
{
  public async findAll():
    Promise<
      WatchlistItem[]
    > {

    const items =
      await WatchlistItemModel
        .find()
        .sort({
          createdAt:
            -1,
        })
        .exec();

    return items.map(
      (
        item
      ) =>
        this.toDomain(
          item
        )
    );
  }

  public async findById(
    id: string
  ): Promise<
    WatchlistItem | null
  > {

    const item =
      await WatchlistItemModel
        .findById(
          id
        )
        .exec();

    return item
      ? this.toDomain(
          item
        )
      : null;
  }

  public async findByDedupKey(
    dedupKey: string
  ): Promise<
    WatchlistItem | null
  > {

    const item =
      await WatchlistItemModel
        .findOne({
          dedupKey,
        })
        .exec();

    return item
      ? this.toDomain(
          item
        )
      : null;
  }

  public async create(
    input:
      CreateWatchlistRecord
  ): Promise<
    WatchlistItem
  > {

    const item =
      await WatchlistItemModel
        .create(
          input
        );

    return this.toDomain(
      item
    );
  }

  public async deleteById(
    id: string
  ): Promise<boolean> {

    const result =
      await WatchlistItemModel
        .deleteOne({
          _id:
            id,
        })
        .exec();

    return (
      result.deletedCount >
      0
    );
  }

  public async setEnabled(
    id: string,
    enabled: boolean
  ): Promise<
    WatchlistItem | null
  > {

    const item =
      await WatchlistItemModel
        .findByIdAndUpdate(
          id,

          {
            enabled,
          },

          {
            new:
              true,
          }
        )
        .exec();

    return item
      ? this.toDomain(
          item
        )
      : null;
  }

  private toDomain(
    item:
      WatchlistItemDocument
  ): WatchlistItem {

    return {
      id:
        String(
          item._id
        ),

      type:
        item.type,

      label:
        item.label,

      dedupKey:
        item.dedupKey,

      enabled:
        item.enabled,

      target:
        item.target,

      rule:
        item.rule ??
        null,

      createdAt:
        item.createdAt
          .toISOString(),

      updatedAt:
        item.updatedAt
          .toISOString(),
    };
  }
}
