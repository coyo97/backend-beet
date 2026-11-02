
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

/*
 * Configuración propia de cada cuenta.
 *
 * Si no tiene configuración,
 * utilizará 8 avisos diarios.
 */
interface DailyPolicy {
  ownerId: string;
  dailyLimit: number;
}

const policySchema = new Schema<DailyPolicy>(
  {
    ownerId: {
      type: String,
      required: true,
      unique: true,
    },
    dailyLimit: {
      type: Number,
      required: true,
      default: 8,
      min: 1,
      max: 20,
    },
  },
  {
    timestamps: true,
    collection: "upcoming_daily_policies",
  }
);

/*
 * Un evento es un partido + ventana.
 * Ejemplo: partido X, aviso de 60m.
 *
 * Se guarda una sola vez por cuenta
 * y por día, aunque tenga 2 teléfonos.
 */
interface DailyUsage {
  ownerId: string;
  dayKey: string;
  eventKeys: string[];
  expiresAt: Date;
}

const usageSchema = new Schema<DailyUsage>(
  {
    ownerId: {
      type: String,
      required: true,
    },
    dayKey: {
      type: String,
      required: true,
    },
    eventKeys: {
      type: [String],
      default: [],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    collection: "upcoming_daily_usage",
  }
);

usageSchema.index(
  { ownerId: 1, dayKey: 1 },
  { unique: true }
);

/*
 * Conservar contadores unos días
 * para diagnóstico y después
 * eliminarlos automáticamente.
 */
usageSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export const UpcomingDailyPolicyModel =
  (mongoose.models.UpcomingDailyPolicy as
    Model<DailyPolicy> | undefined) ??
  mongoose.model<DailyPolicy>(
    "UpcomingDailyPolicy",
    policySchema
  );

export const UpcomingDailyUsageModel =
  (mongoose.models.UpcomingDailyUsage as
    Model<DailyUsage> | undefined) ??
  mongoose.model<DailyUsage>(
    "UpcomingDailyUsage",
    usageSchema
  );

