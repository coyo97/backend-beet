
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export interface TeamMemoryLiveVolumePolicyData {
  ownerId: string;
  dailyLimit: number;
  cooldownMinutes: number;
}

export interface TeamMemoryLiveVolumeUsageData {
  ownerId: string;
  dayKey: string;
  eventKeys: string[];
  lastReservedAt: Date | null;
}

const policySchema =
  new Schema<TeamMemoryLiveVolumePolicyData>(
    {
      ownerId: {
        type: String,
        required: true,
        unique: true,
      },

      dailyLimit: {
        type: Number,
        required: true,
        default: 4,
        min: 1,
        max: 20,
      },

      cooldownMinutes: {
        type: Number,
        required: true,
        default: 30,
        enum: [0, 15, 30, 60, 120],
      },
    },
    {
      timestamps: true,
      collection: "team_memory_live_volume_policies",
    }
  );

const usageSchema =
  new Schema<TeamMemoryLiveVolumeUsageData>(
    {
      ownerId: {
        type: String,
        required: true,
        unique: true,
      },

      dayKey: {
        type: String,
        required: true,
        default: "1970-01-01",
      },

      eventKeys: {
        type: [String],
        default: [],
      },

      lastReservedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      collection: "team_memory_live_volume_usage",
    }
  );

/*
 * Un documento de consumo por cuenta.
 *
 * Al cambiar de día se reemplazan
 * los eventos contabilizados.
 *
 * lastReservedAt permanece para
 * respetar el intervalo entre días.
 */

export const TeamMemoryLiveVolumePolicyModel =
  (mongoose.models.TeamMemoryLiveVolumePolicy as
    Model<TeamMemoryLiveVolumePolicyData> | undefined) ??
  mongoose.model<TeamMemoryLiveVolumePolicyData>(
    "TeamMemoryLiveVolumePolicy",
    policySchema
  );

export const TeamMemoryLiveVolumeUsageModel =
  (mongoose.models.TeamMemoryLiveVolumeUsage as
    Model<TeamMemoryLiveVolumeUsageData> | undefined) ??
  mongoose.model<TeamMemoryLiveVolumeUsageData>(
    "TeamMemoryLiveVolumeUsage",
    usageSchema
  );

