import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  WatchlistItemType,
  WatchlistRadarRule,
  WatchlistTarget,
} from "../../../domain/entities/WatchlistItem";

export interface WatchlistItemPersistence {
  type:
    WatchlistItemType;

  label:
    string;

  dedupKey:
    string;

  enabled:
    boolean;

  target:
    WatchlistTarget;

  rule:
    WatchlistRadarRule |
    null;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type WatchlistItemDocument =
  HydratedDocument<
    WatchlistItemPersistence
  >;

/*
 * -------------------------------------------------
 * Target
 * -------------------------------------------------
 *
 * Datos que identifican aquello que seguimos:
 *
 * match
 * team
 * competition
 * country
 * radar-rule
 */
const watchlistTargetSchema =
  new Schema<WatchlistTarget>(
    {
      provider: {
        type:
          String,

        default:
          null,
      },

      externalId: {
        type:
          String,

        default:
          null,
      },

      name: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      country: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      competition: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      homeName: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      awayName: {
        type:
          String,

        trim:
          true,

        default:
          null,
      },

      kickoffAt: {
        type:
          String,

        default:
          null,
      },
    },

    {
      _id:
        false,
    }
  );

/*
 * -------------------------------------------------
 * Radar rule
 * -------------------------------------------------
 *
 * Reglas configurables para:
 *
 * RED_CARD_PRESSURE
 *
 * Ejemplo:
 *
 * Brasil
 * + strong
 * + minuto >= 60
 * + presión >= 65
 */
const watchlistRadarRuleSchema =
  new Schema<WatchlistRadarRule>(
    {
      event: {
        type:
          String,

        required:
          true,

        enum: [
          "RED_CARD_PRESSURE",
        ],
      },

      country: {
        type:
          String,

        trim:
          true,
      },

      competition: {
        type:
          String,

        trim:
          true,
      },

      teamName: {
        type:
          String,

        trim:
          true,
      },

      minimumStrength: {
        type:
          String,

        enum: [
          "clear",
          "strong",
        ],
      },

      minimumMinute: {
        type:
          Number,

        min:
          0,

        max:
          200,
      },

      maximumMinute: {
        type:
          Number,

        min:
          0,

        max:
          200,
      },

      minimumPressureScore: {
        type:
          Number,

        min:
          0,

        max:
          100,
      },

      teamMustHaveAdvantage: {
        type:
          Boolean,

        default:
          false,
      },
    },

    {
      _id:
        false,
    }
  );

/*
 * -------------------------------------------------
 * Watchlist item
 * -------------------------------------------------
 */
const watchlistItemSchema =
  new Schema<
    WatchlistItemPersistence
  >(
    {
      type: {
        type:
          String,

        required:
          true,

        enum: [
          "match",
          "team",
          "competition",
          "country",
          "radar-rule",
        ],

        index:
          true,
      },

      label: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      dedupKey: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      enabled: {
        type:
          Boolean,

        default:
          true,

        index:
          true,
      },

      target: {
        type:
          watchlistTargetSchema,

        required:
          true,
      },

      rule: {
        type:
          watchlistRadarRuleSchema,

        default:
          null,
      },
    },

    {
      timestamps:
        true,

      collection:
        "watchlist_items",
    }
  );

/*
 * Índice útil cuando el Radar necesita
 * consultar elementos activos por tipo.
 */
watchlistItemSchema.index({
  enabled:
    1,

  type:
    1,
});

/*
 * -------------------------------------------------
 * Model
 * -------------------------------------------------
 *
 * Evita OverwriteModelError durante hot reload.
 */
const existingModel =
  mongoose.models
    .WatchlistItem as
    | Model<
        WatchlistItemPersistence
      >
    | undefined;

export const WatchlistItemModel =
  existingModel ??
  mongoose.model<
    WatchlistItemPersistence
  >(
    "WatchlistItem",
    watchlistItemSchema
  );
