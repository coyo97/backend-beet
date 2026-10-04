import type {
  SaveTeamPersonalProfileInput,
  TeamPersonalProfile,
} from "../../domain/entities/TeamPersonalProfile";

import type {
  TeamPersonalProfileRepository,
} from "../../domain/repositories/TeamPersonalProfileRepository";

import {
  TeamPersonalProfileModel,
  type TeamPersonalProfileDocument,
} from "../database/models/TeamPersonalProfileModel";

function normalizeTeamName(
  value:
    string
): string {

  return value
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

export class MongooseTeamPersonalProfileRepository
  implements TeamPersonalProfileRepository
{
  public async save(
    ownerId:
      string,

    input:
      SaveTeamPersonalProfileInput
  ): Promise<
    TeamPersonalProfile
  > {

    const teamName =
      input.teamName
        .trim();

    const teamKey =
      normalizeTeamName(
        teamName
      );

    const document =
      await TeamPersonalProfileModel
        .findOneAndUpdate(
          {
            ownerId:
              ownerId.trim(),

            teamKey,
          },

          {
            $set: {
              teamName,

              label:
                input.label ??
                null,

              note:
                input.note
                  ?.trim() ||
                null,
            },
          },

          {
            new:
              true,

            upsert:
              true,

            setDefaultsOnInsert:
              true,
          }
        )
        .exec();

    if (
      !document
    ) {
      throw new Error(
        "Could not save team personal profile"
      );
    }

    return this.toDomain(
      document
    );
  }

  public async findByTeam(
    ownerId:
      string,

    teamName:
      string
  ): Promise<
    TeamPersonalProfile |
    null
  > {

    const document =
      await TeamPersonalProfileModel
        .findOne({
          ownerId:
            ownerId.trim(),

          teamKey:
            normalizeTeamName(
              teamName
            ),
        })
        .exec();

    return document
      ? this.toDomain(
          document
        )
      : null;
  }

  public async list(
    ownerId:
      string
  ): Promise<
    TeamPersonalProfile[]
  > {

    const documents =
      await TeamPersonalProfileModel
        .find({
          ownerId:
            ownerId.trim(),
        })
        .sort({
          updatedAt:
            -1,
        })
        .limit(
          500
        )
        .exec();

    return documents.map(
      (
        document
      ) =>
        this.toDomain(
          document
        )
    );
  }

  public async deleteByTeam(
    ownerId:
      string,

    teamName:
      string
  ): Promise<boolean> {

    const result =
      await TeamPersonalProfileModel
        .deleteOne({
          ownerId:
            ownerId.trim(),

          teamKey:
            normalizeTeamName(
              teamName
            ),
        })
        .exec();

    return (
      result.deletedCount >
      0
    );
  }

  private toDomain(
    document:
      TeamPersonalProfileDocument
  ): TeamPersonalProfile {

    return {
      id:
        String(
          document._id
        ),

      teamName:
        document.teamName,

      teamKey:
        document.teamKey,

      label:
        document.label,

      note:
        document.note,

      createdAt:
        document.createdAt
          .toISOString(),

      updatedAt:
        document.updatedAt
          .toISOString(),
    };
  }
}
