
import mongoose from "mongoose";

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
  private isValidOwner(
    ownerId?: string
  ): ownerId is string {
    return (
      typeof ownerId === "string" &&
      mongoose.isValidObjectId(ownerId)
    );
  }


  /*
   * Obtiene únicamente identificadores
   * de propietarios con Watchlist activa.
   *
   * Los documentos antiguos sin ownerId
   * quedan excluidos de manera segura.
   */
  public async findActiveOwnerIds():
    Promise<string[]> {

    const ownerIds =
      await WatchlistItemModel
        .distinct(
          "ownerId",
          {
            enabled: true,

            ownerId: {
              $type: "objectId",
            },
          }
        )
        .exec();

    return ownerIds
      .map(
        ownerId => String(ownerId)
      )
      .filter(
        ownerId =>
          mongoose.isValidObjectId(
            ownerId
          )
      );
  }


  public async findAll(
    ownerId?: string
  ): Promise<WatchlistItem[]> {

    if (!this.isValidOwner(ownerId)) {
      return [];
    }

    const items =
      await WatchlistItemModel
        .find({
          ownerId,
        })
        .sort({
          createdAt: -1,
        })
        .exec();

    return items.map(
      item => this.toDomain(item)
    );
  }

  public async findById(
    id: string,
    ownerId?: string
  ): Promise<WatchlistItem | null> {

    if (
      !this.isValidOwner(ownerId) ||
      !mongoose.isValidObjectId(id)
    ) {
      return null;
    }

    const item =
      await WatchlistItemModel
        .findOne({
          _id: id,
          ownerId,
        })
        .exec();

    return item
      ? this.toDomain(item)
      : null;
  }

  public async findByDedupKey(
    dedupKey: string,
    ownerId?: string
  ): Promise<WatchlistItem | null> {

    if (!this.isValidOwner(ownerId)) {
      return null;
    }

    const item =
      await WatchlistItemModel
        .findOne({
          ownerId,
          dedupKey,
        })
        .exec();

    return item
      ? this.toDomain(item)
      : null;
  }

  public async create(
    input: CreateWatchlistRecord
  ): Promise<WatchlistItem> {

    if (!this.isValidOwner(input.ownerId)) {
      throw new Error(
        "Invalid watchlist owner"
      );
    }

    const item =
      await WatchlistItemModel
        .create({
          ...input,
          ownerId:
            new mongoose.Types.ObjectId(
              input.ownerId
            ),
        });

    return this.toDomain(item);
  }

  public async deleteById(
    id: string,
    ownerId?: string
  ): Promise<boolean> {

    if (
      !this.isValidOwner(ownerId) ||
      !mongoose.isValidObjectId(id)
    ) {
      return false;
    }

    const result =
      await WatchlistItemModel
        .deleteOne({
          _id: id,
          ownerId,
        })
        .exec();

    return result.deletedCount > 0;
  }

  public async setEnabled(
    id: string,
    enabled: boolean,
    ownerId?: string
  ): Promise<WatchlistItem | null> {

    if (
      !this.isValidOwner(ownerId) ||
      !mongoose.isValidObjectId(id)
    ) {
      return null;
    }

    const item =
      await WatchlistItemModel
        .findOneAndUpdate(
          {
            _id: id,
            ownerId,
          },
          {
            $set: {
              enabled,
            },
          },
          {
            new: true,
          }
        )
        .exec();

    return item
      ? this.toDomain(item)
      : null;
  }

  private toDomain(
    item: WatchlistItemDocument
  ): WatchlistItem {

    return {
      id: String(item._id),

      ownerId: item.ownerId
        ? String(item.ownerId)
        : null,

      type: item.type,

      label: item.label,

      dedupKey: item.dedupKey,

      enabled: item.enabled,

      target: item.target,

      rule: item.rule ?? null,

      createdAt:
        item.createdAt.toISOString(),

      updatedAt:
        item.updatedAt.toISOString(),
    };
  }
}

