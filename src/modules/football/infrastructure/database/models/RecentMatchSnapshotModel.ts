import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

export type RecentMatchState =
  | "live"
  | "recent"
  | "expired";

interface Persistence {
  sourceKeys:
    string[];

  state:
    RecentMatchState;

  snapshot:
    unknown;

  firstSeenAt:
    Date;

  lastSeenAt:
    Date;

  missingSince:
    Date | null;

  endedAt:
    Date | null;

  resultConfirmed:
    boolean;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type RecentMatchSnapshotDocument =
  HydratedDocument<
    Persistence
  >;

const schema =
  new Schema<Persistence>(
    {
      sourceKeys: {
        type: [
          String,
        ],

        required:
          true,

        index:
          true,
      },

      state: {
        type:
          String,

        required:
          true,

        enum: [
          "live",
          "recent",
          "expired",
        ],

        index:
          true,
      },

      snapshot: {
        type:
          Schema.Types.Mixed,

        required:
          true,
      },

      firstSeenAt: {
        type:
          Date,

        required:
          true,
      },

      lastSeenAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      missingSince: {
        type:
          Date,

        default:
          null,
      },

      endedAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      resultConfirmed: {
        type:
          Boolean,

        default:
          false,
      },
    },

    {
      collection:
        "recent_match_snapshots",

      timestamps:
        true,
    }
  );

schema.index({
  state:
    1,

  endedAt:
    -1,
});

/*
 * Limpieza automática.
 *
 * Conservamos snapshots durante
 * 7 días aunque la UI normalmente
 * solo enseñará 48 horas.
 */
schema.index(
  {
    updatedAt:
      1,
  },
  {
    expireAfterSeconds:
      7 *
      24 *
      60 *
      60,
  }
);

const existing =
  mongoose.models
    .RecentMatchSnapshot as
    | Model<Persistence>
    | undefined;

export const RecentMatchSnapshotModel =
  existing ??
  mongoose.model<Persistence>(
    "RecentMatchSnapshot",
    schema
  );
