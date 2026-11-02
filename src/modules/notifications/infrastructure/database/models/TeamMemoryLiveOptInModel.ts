
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export interface TeamMemoryLiveOptInPersistence {
  recipientKey: string;

  ownerId: mongoose.Types.ObjectId;

  enabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const schema =
  new Schema<TeamMemoryLiveOptInPersistence>(
    {
      /*
       * SHA256 del token Expo.
       * Nunca guardamos el token
       * completo en esta colección.
       */
      recipientKey: {
        type: String,
        required: true,
        unique: true,
      },

      ownerId: {
        type: Schema.Types.ObjectId,
        ref: "RadarUser",
        required: true,
        index: true,
      },

      enabled: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
    {
      timestamps: true,
      collection: "team_memory_live_opt_ins",
    }
  );

schema.index({
  ownerId: 1,
  enabled: 1,
});

const existing =
  mongoose.models.TeamMemoryLiveOptIn as
    | Model<TeamMemoryLiveOptInPersistence>
    | undefined;

export const TeamMemoryLiveOptInModel =
  existing ??
  mongoose.model<TeamMemoryLiveOptInPersistence>(
    "TeamMemoryLiveOptIn",
    schema
  );

