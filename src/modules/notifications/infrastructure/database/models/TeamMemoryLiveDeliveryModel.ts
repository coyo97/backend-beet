
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export type TeamMemoryDeliveryStatus =
  | "reserved"
  | "accepted"
  | "rejected"
  | "unknown";

export interface TeamMemoryLiveDeliveryPersistence {
  ownerId: string;
  matchKey: string;
  type: "TEAM_MEMORY_LIVE";
  recipientKey: string;

  status: TeamMemoryDeliveryStatus;

  reservedAt: Date;
  completedAt: Date | null;

  expoTicketId: string | null;
  errorCode: string | null;

  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const schema =
  new Schema<TeamMemoryLiveDeliveryPersistence>(
    {
      ownerId: {
        type: String,
        required: true,
      },

      matchKey: {
        type: String,
        required: true,
      },

      type: {
        type: String,
        enum: ["TEAM_MEMORY_LIVE"],
        required: true,
      },

      /*
       * SHA256 del token Expo.
       * No guardamos el token real
       * en la colección de entregas.
       */
      recipientKey: {
        type: String,
        required: true,
      },

      status: {
        type: String,
        enum: [
          "reserved",
          "accepted",
          "rejected",
          "unknown",
        ],
        required: true,
        default: "reserved",
      },

      reservedAt: {
        type: Date,
        required: true,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      expoTicketId: {
        type: String,
        default: null,
      },

      errorCode: {
        type: String,
        default: null,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      collection: "team_memory_live_deliveries",
    }
  );

/*
 * Protección contra duplicados,
 * incluso con dos procesos
 * intentando enviar simultáneamente.
 */
schema.index(
  {
    ownerId: 1,
    matchKey: 1,
    type: 1,
    recipientKey: 1,
  },
  {
    unique: true,
  }
);

/*
 * Limpiar registros antiguos.
 */
schema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const existing =
  mongoose.models.TeamMemoryLiveDelivery as
    | Model<TeamMemoryLiveDeliveryPersistence>
    | undefined;

export const TeamMemoryLiveDeliveryModel =
  existing ??
  mongoose.model<TeamMemoryLiveDeliveryPersistence>(
    "TeamMemoryLiveDelivery",
    schema
  );

