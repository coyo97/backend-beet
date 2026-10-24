import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
} from "mongoose";

interface IncidentPersistence {
  id:
    string |
    null;

  side:
    "home" |
    "away" |
    null;

  minute:
    string |
    null;

  minuteNumber:
    number |
    null;

  type:
    string |
    null;

  reason:
    string |
    null;

  description:
    string |
    null;

  player:
    {
      id:
        string |
        null;

      name:
        string |
        null;
    } |
    null;

  homeScore:
    number |
    null;

  awayScore:
    number |
    null;
}

interface Persistence {
  sourceKeys:
    string[];

  incidentSource: {
    provider:
      string;

    externalId:
      string;
  };

  kickoffAt:
    Date;

  status: {
    long:
      string;

    short:
      string;

    minute:
      number |
      null;
  };

  competition: {
    id:
      string |
      null;

    name:
      string;

    country:
      string;

    season:
      string |
      null;

    round:
      string |
      null;
  };

  home: {
    id:
      string |
      null;

    name:
      string;

    goals:
      number |
      null;
  };

  away: {
    id:
      string |
      null;

    name:
      string;

    goals:
      number |
      null;
  };

  incidents:
    IncidentPersistence[];

  firstCapturedAt:
    Date;

  lastCapturedAt:
    Date;

  createdAt:
    Date;

  updatedAt:
    Date;
}

export type MatchEventSnapshotDocument =
  HydratedDocument<
    Persistence
  >;

const playerSchema =
  new Schema(
    {
      id: {
        type:
          String,

        default:
          null,
      },

      name: {
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

const incidentSchema =
  new Schema(
    {
      id: {
        type:
          String,

        default:
          null,
      },

      side: {
        type:
          String,

        default:
          null,
      },

      minute: {
        type:
          String,

        default:
          null,
      },

      minuteNumber: {
        type:
          Number,

        default:
          null,

        index:
          true,
      },

      type: {
        type:
          String,

        default:
          null,
      },

      reason: {
        type:
          String,

        default:
          null,
      },

      description: {
        type:
          String,

        default:
          null,
      },

      player: {
        type:
          playerSchema,

        default:
          null,
      },

      homeScore: {
        type:
          Number,

        default:
          null,
      },

      awayScore: {
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

      incidentSource: {
        provider: {
          type:
            String,

          required:
            true,
        },

        externalId: {
          type:
            String,

          required:
            true,
        },
      },

      kickoffAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      status: {
        long: {
          type:
            String,

          required:
            true,
        },

        short: {
          type:
            String,

          required:
            true,
        },

        minute: {
          type:
            Number,

          default:
            null,
        },
      },

      competition: {
        id: {
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
        },

        country: {
          type:
            String,

          required:
            true,
        },

        season: {
          type:
            String,

          default:
            null,
        },

        round: {
          type:
            String,

          default:
            null,
        },
      },

      home: {
        id: {
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
        },

        goals: {
          type:
            Number,

          default:
            null,
        },
      },

      away: {
        id: {
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
        },

        goals: {
          type:
            Number,

          default:
            null,
        },
      },

      incidents: {
        type: [
          incidentSchema,
        ],

        default: [],
      },

      firstCapturedAt: {
        type:
          Date,

        required:
          true,
      },

      lastCapturedAt: {
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
        "match_event_snapshots",

      timestamps:
        true,
    }
  );

/*
 * Encontrar rápidamente un partido por
 * cualquiera de sus fuentes:
 *
 * flashscore:abc
 * sofascore:123
 * etc.
 */

/*
 * Preparado para futuros análisis
 * históricos por equipo.
 */
schema.index({
  "home.name":
    1,

  kickoffAt:
    -1,
});

schema.index({
  "away.name":
    1,

  kickoffAt:
    -1,
});

const existing =
  mongoose.models
    .MatchEventSnapshot as
    | Model<Persistence>
    | undefined;

export const MatchEventSnapshotModel =
  existing ??
  mongoose.model<Persistence>(
    "MatchEventSnapshot",
    schema
  );
