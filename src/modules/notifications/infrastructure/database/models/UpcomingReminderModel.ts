
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export type UpcomingReminderWindow =
  | "24h"
  | "60m";

export type UpcomingReminderStatus =
  | "planned"
  | "sent"
  | "cancelled";

export interface UpcomingReminderPersistence {
  matchKey: string;
  window: UpcomingReminderWindow;

  status: UpcomingReminderStatus;

  kickoffAt: Date;
  dueAt: Date;
  expiresAt: Date;

  title: string;
  body: string;

  homeName: string;
  awayName: string;

  pointsGap: number;
  positionGap: number;
  dataQuality: number;

  sentAt: Date | null;
}

const upcomingReminderSchema =
  new Schema<UpcomingReminderPersistence>(
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

      status: {
        type: String,
        enum: [
          "planned",
          "sent",
          "cancelled",
        ],
        default: "planned",
        required: true,
      },

      kickoffAt: {
        type: Date,
        required: true,
      },

      dueAt: {
        type: Date,
        required: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },

      title: {
        type: String,
        required: true,
      },

      body: {
        type: String,
        required: true,
      },

      homeName: {
        type: String,
        required: true,
      },

      awayName: {
        type: String,
        required: true,
      },

      pointsGap: {
        type: Number,
        required: true,
      },

      positionGap: {
        type: Number,
        required: true,
      },

      dataQuality: {
        type: Number,
        required: true,
      },

      sentAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      collection: "upcoming_reminders",
    }
  );

/*
 * Una sola programación por
 * partido y ventana.
 */
upcomingReminderSchema.index(
  {
    matchKey: 1,
    window: 1,
  },
  {
    unique: true,
  }
);

/*
 * Buscar recordatorios cuyo
 * momento de envío ha llegado.
 */
upcomingReminderSchema.index({
  status: 1,
  dueAt: 1,
});

/*
 * Limpieza automática.
 */
upcomingReminderSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

const existing =
  mongoose.models.UpcomingReminder as
    | Model<UpcomingReminderPersistence>
    | undefined;

export const UpcomingReminderModel =
  existing ??
  mongoose.model<UpcomingReminderPersistence>(
    "UpcomingReminder",
    upcomingReminderSchema
  );

