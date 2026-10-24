import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

import type {
  MatchLineupStatus,
} from "../../../domain/entities/MatchLineupSnapshot";

interface PlayerPersistence {
  playerId:
    string |
    null;

  name:
    string;

  position:
    string |
    null;

  isGoalkeeper:
    boolean;
}

interface TeamPersistence {
  teamId:
    string |
    null;

  teamName:
    string;

  starters:
    PlayerPersistence[];

  substitutes:
    PlayerPersistence[];
}

interface Persistence {
  provider:
    string;

  externalId:
    string;

  sourceKey:
    string;

  kickoffAt:
    Date |
    null;

  status:
    MatchLineupStatus;

  home:
    TeamPersistence;

  away:
    TeamPersistence;

  fetchedAt:
    Date;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type MatchLineupSnapshotDocument =
  HydratedDocument<
    Persistence
  >;

const playerSchema =
  new Schema<PlayerPersistence>(
    {
      playerId: {
        type:
          String,

        default:
          null,
      },

      name: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      position: {
        type:
          String,

        default:
          null,
      },

      isGoalkeeper: {
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

const teamSchema =
  new Schema<TeamPersistence>(
    {
      teamId: {
        type:
          String,

        default:
          null,
      },

      teamName: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      starters: {
        type: [
          playerSchema,
        ],

        default:
          [],
      },

      substitutes: {
        type: [
          playerSchema,
        ],

        default:
          [],
      },
    },
    {
      _id:
        false,
    }
  );

const schema =
  new Schema<Persistence>(
    {
      provider: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      externalId: {
        type:
          String,

        required:
          true,
      },

      sourceKey: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      kickoffAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      status: {
        type:
          String,

        required:
          true,

        enum: [
          "confirmed",
          "partial",
          "unavailable",
        ],

        index:
          true,
      },

      home: {
        type:
          teamSchema,

        required:
          true,
      },

      away: {
        type:
          teamSchema,

        required:
          true,
      },

      fetchedAt: {
        type:
          Date,

        required:
          true,
      },
    },

    {
      collection:
        "match_lineup_snapshots",

      timestamps:
        true,
    }
  );

/*
 * Consultas históricas:
 *
 * últimos partidos confirmados
 * donde un equipo fue local o visitante.
 */
schema.index({
  "home.teamId":
    1,

  status:
    1,

  kickoffAt:
    -1,
});

schema.index({
  "away.teamId":
    1,

  status:
    1,

  kickoffAt:
    -1,
});

const existing =
  mongoose.models
    .MatchLineupSnapshot as
    | Model<Persistence>
    | undefined;

export const MatchLineupSnapshotModel =
  existing ??
  mongoose.model<Persistence>(
    "MatchLineupSnapshot",
    schema
  );
