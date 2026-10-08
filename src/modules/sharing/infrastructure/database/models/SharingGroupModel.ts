import mongoose, {
  Schema,
  type Model,
  type Types,
} from "mongoose";

interface SharingGroupPersistence {
  name:
    string;

  inviteCode:
    string;

  createdBy:
    Types.ObjectId;

  memberIds:
    Types.ObjectId[];

  createdAt:
    Date;

  updatedAt:
    Date;
}

const schema =
  new Schema<SharingGroupPersistence>(
    {
      name: {
        type:
          String,

        required:
          true,

        trim:
          true,

        maxlength:
          50,
      },

      inviteCode: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,

        trim:
          true,

        uppercase:
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

      memberIds: [
        {
          type:
            Schema.Types.ObjectId,

          ref:
            "RadarUser",
        },
      ],
    },
    {
      collection:
        "sharing_groups",

      timestamps:
        true,
    }
  );

schema.index({
  memberIds:
    1,
});

const existing =
  mongoose.models
    .SharingGroup as
    | Model<SharingGroupPersistence>
    | undefined;

export const SharingGroupModel =
  existing ??
  mongoose.model<SharingGroupPersistence>(
    "SharingGroup",
    schema
  );
