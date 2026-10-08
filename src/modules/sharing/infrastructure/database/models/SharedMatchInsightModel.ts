import mongoose, {
  Schema,
  type Model,
  type Types,
} from "mongoose";

import type {
  SharedMatchAction,
  SharedMatchSide,
} from "../../../domain/entities/Sharing";

interface MatchSourcePersistence {
  provider:
    string;

  externalId:
    string;
}

interface MatchPersistence {
  sources:
    MatchSourcePersistence[];

  kickoffAt:
    Date;

  competitionName:
    string | null;

  country:
    string | null;

  homeName:
    string;

  awayName:
    string;

  homeGoals:
    number | null;

  awayGoals:
    number | null;

  minute:
    number | null;
}

interface SharedMatchInsightPersistence {
  groupId:
    Types.ObjectId;

  createdBy:
    Types.ObjectId;

  action:
    SharedMatchAction;

  selectedSide:
    SharedMatchSide | null;

  note:
    string | null;

  match:
    MatchPersistence;

  expiresAt:
    Date;

  createdAt:
    Date;

  updatedAt:
    Date;
}

const sourceSchema =
  new Schema<MatchSourcePersistence>(
    {
      provider: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      externalId: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },
    },
    {
      _id:
        false,
    }
  );

const matchSchema =
  new Schema<MatchPersistence>(
    {
      sources: {
        type: [
          sourceSchema,
        ],

        required:
          true,
      },

      kickoffAt: {
        type:
          Date,

        required:
          true,
      },

      competitionName: {
        type:
          String,

        default:
          null,
      },

      country: {
        type:
          String,

        default:
          null,
      },

      homeName: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      awayName: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      homeGoals: {
        type:
          Number,

        default:
          null,
      },

      awayGoals: {
        type:
          Number,

        default:
          null,
      },

      minute: {
        type:
          Number,

        default:
          null,
      },
    },
    {
      _id:
        false,
    }
  );

const schema =
  new Schema<SharedMatchInsightPersistence>(
    {
      groupId: {
        type:
          Schema.Types.ObjectId,

        required:
          true,

        ref:
          "SharingGroup",

        index:
          true,
      },

      createdBy: {
        type:
          Schema.Types.ObjectId,

        required:
          true,

        ref:
          "RadarUser",

        index:
          true,
      },

      action: {
        type:
          String,

        required:
          true,

        enum: [
          "share",
          "leaning",
          "bet",
        ],
      },

      selectedSide: {
        type:
          String,

        enum: [
          "home",
          "away",
          null,
        ],

        default:
          null,
      },

      note: {
        type:
          String,

        trim:
          true,

        maxlength:
          160,

        default:
          null,
      },

      match: {
        type:
          matchSchema,

        required:
          true,
      },

      expiresAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },
    },
    {
      collection:
        "shared_match_insights",

      timestamps:
        true,
    }
  );

/*
 * Mongo elimina automáticamente
 * compartidos vencidos.
 */
schema.index(
  {
    expiresAt:
      1,
  },
  {
    expireAfterSeconds:
      0,
  }
);

schema.index({
  groupId:
    1,

  createdAt:
    -1,
});

const existing =
  mongoose.models
    .SharedMatchInsight as
    | Model<SharedMatchInsightPersistence>
    | undefined;

export const SharedMatchInsightModel =
  existing ??
  mongoose.model<SharedMatchInsightPersistence>(
    "SharedMatchInsight",
    schema
  );
