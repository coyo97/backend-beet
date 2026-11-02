
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

import type {
  UpcomingReminderWindow,
} from "./UpcomingReminderModel";

export type UpcomingDeliveryStatus =
  | "reserved"
  | "accepted"
  | "rejected"
  | "unknown";

export interface UpcomingReminderDeliveryPersistence {
  matchKey: string;

  window: UpcomingReminderWindow;

  /*
   * SHA-256 del Expo Push Token.
   *
   * No necesitamos guardar
   * nuevamente el token original.
   */
  recipientKey: string;

  status: UpcomingDeliveryStatus;

  reservedAt: Date;
  completedAt: Date | null;

  expoTicketId: string | null;
  errorCode: string | null;

  expiresAt: Date;
}

const deliverySchema =
  new Schema<UpcomingReminderDeliveryPersistence>(
    {
      matchKey: {
        type: String,
        required: true,
      },

      window: {
        type: String,
        enum: ["24h", "60m"],
        required: true,
      },

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
      collection: "upcoming_reminder_deliveries",
    }
  );

/*
 * Protección principal:
 *
 * Un único intento reservado
 * por partido, ventana y
 * dispositivo.
 */
deliverySchema.index(
  {
    matchKey: 1,
    window: 1,
    recipientKey: 1,
  },
  {
    unique: true,
  }
);

deliverySchema.index({
  status: 1,
  reservedAt: 1,
});

deliverySchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const existing =
  mongoose.models.UpcomingReminderDelivery as
    | Model<UpcomingReminderDeliveryPersistence>
    | undefined;

export const UpcomingReminderDeliveryModel =
  existing ??
  mongoose.model<UpcomingReminderDeliveryPersistence>(
    "UpcomingReminderDelivery",
    deliverySchema
  );

