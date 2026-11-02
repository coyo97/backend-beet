
import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export interface UpcomingPushOptInPersistence {
  recipientKey: string;

  /*
   * Propietario autenticado.
   *
   * Opcional en la interfaz para
   * tolerar documentos antiguos.
   */
  ownerId?: mongoose.Types.ObjectId | null;

  enabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const schema =
  new Schema<UpcomingPushOptInPersistence>(
    {
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
      collection: "upcoming_push_opt_ins",
    }
  );

schema.index({
  ownerId: 1,
  enabled: 1,
});

const existing =
  mongoose.models.UpcomingPushOptIn as
    | Model<UpcomingPushOptInPersistence>
    | undefined;

export const UpcomingPushOptInModel =
  existing ??
  mongoose.model<UpcomingPushOptInPersistence>(
    "UpcomingPushOptIn",
    schema
  );

