import mongoose, {
  Schema,
  type Model,
} from "mongoose";

export interface RadarUserRecord {
  username:
    string;

  usernameKey:
    string;

  passwordHash:
    string;

  createdAt:
    Date;

  updatedAt:
    Date;
}

const schema =
  new Schema<RadarUserRecord>(
    {
      username: {
        type: String,
        required: true,
        trim: true,
      },

      usernameKey: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      passwordHash: {
        type: String,
        required: true,
      },
    },
    {
      collection: "radar_users",
      timestamps: true,
    }
  );

schema.index(
  { usernameKey: 1 },
  { unique: true }
);

const existing =
  mongoose.models.RadarUser as
    | Model<RadarUserRecord>
    | undefined;

export const RadarUserModel =
  existing ??
  mongoose.model<RadarUserRecord>(
    "RadarUser",
    schema
  );
