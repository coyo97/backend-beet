import crypto
  from "node:crypto";

import mongoose
  from "mongoose";

import {
  RadarUserModel,
} from "../../../auth/infrastructure/database/models/RadarUserModel";

import {
  SharingGroupModel,
} from "../../infrastructure/database/models/SharingGroupModel";

import {
  SharedMatchInsightModel,
} from "../../infrastructure/database/models/SharedMatchInsightModel";

import type {
  SharedMatchAction,
  SharedMatchSide,
  SharedMatchSnapshot,
} from "../../domain/entities/Sharing";

const INVITE_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode():
  string {
  const bytes =
    crypto.randomBytes(
      8
    );

  let result =
    "";

  for (
    let index = 0;
    index < 8;
    index += 1
  ) {
    result +=
      INVITE_ALPHABET[
        bytes[index] %
        INVITE_ALPHABET.length
      ];
  }

  return result;
}

async function createUniqueInviteCode():
  Promise<string> {
  for (
    let attempt = 0;
    attempt < 10;
    attempt += 1
  ) {
    const code =
      generateInviteCode();

    const exists =
      await SharingGroupModel
        .exists({
          inviteCode:
            code,
        });

    if (!exists) {
      return code;
    }
  }

  throw new Error(
    "Could not generate invite code"
  );
}

function getExpirationDate(
  kickoffAt:
    string
): Date {
  const now =
    Date.now();

  /*
   * Como mínimo dura 12 horas
   * desde que se compartió.
   */
  const minimum =
    now +
    12 *
      60 *
      60 *
      1000;

  /*
   * También garantizamos unas horas
   * después del inicio del partido.
   */
  const kickoff =
    new Date(
      kickoffAt
    )
      .getTime();

  const matchExpiration =
    Number.isFinite(
      kickoff
    )
      ? kickoff +
        8 *
          60 *
          60 *
          1000
      : minimum;

  return new Date(
    Math.max(
      minimum,
      matchExpiration
    )
  );
}

export class SharingService {
  public async getMyGroup(
    userId:
      string
  ) {
    return SharingGroupModel
      .findOne({
        memberIds:
          userId,
      })
      .lean();
  }

  public async createGroup(
    userId:
      string,

    name:
      string
  ) {
    const current =
      await this.getMyGroup(
        userId
      );

    if (current) {
      throw new Error(
        "ALREADY_IN_GROUP"
      );
    }

    const inviteCode =
      await createUniqueInviteCode();

    return SharingGroupModel
      .create({
        name:
          name.trim() ||
          "Mi grupo",

        inviteCode,

        createdBy:
          new mongoose.Types.ObjectId(
            userId
          ),

        memberIds: [
          new mongoose.Types.ObjectId(
            userId
          ),
        ],
      });
  }

  public async joinGroup(
    userId:
      string,

    inviteCode:
      string
  ) {
    const current =
      await this.getMyGroup(
        userId
      );

    if (current) {
      throw new Error(
        "ALREADY_IN_GROUP"
      );
    }

    const group =
      await SharingGroupModel
        .findOne({
          inviteCode:
            inviteCode
              .trim()
              .toUpperCase(),
        });

    if (!group) {
      throw new Error(
        "GROUP_NOT_FOUND"
      );
    }

const memberId =
  new mongoose.Types.ObjectId(
    userId
  );

const alreadyMember =
  group.memberIds.some(
    item =>
      String(item) ===
      userId
  );

if (!alreadyMember) {
  group.memberIds.push(
    memberId
  );
}

await group.save();

    await group.save();

    return group;
  }

  public async shareMatch(
    userId:
      string,

    input: {
      action:
        SharedMatchAction;

      selectedSide:
        SharedMatchSide |
        null;

      note:
        string | null;

      match:
        SharedMatchSnapshot;
    }
  ) {
    const group =
      await this.getMyGroup(
        userId
      );

    if (!group) {
      throw new Error(
        "NO_GROUP"
      );
    }

    /*
     * Solo "leaning" y "bet"
     * requieren elegir equipo.
     *
     * "share" no necesita equipo.
     */
    if (
      input.action !==
        "share" &&
      !input.selectedSide
    ) {
      throw new Error(
        "SIDE_REQUIRED"
      );
    }

    const insight =
      await SharedMatchInsightModel
        .create({
          groupId:
            group._id,

          createdBy:
            new mongoose.Types.ObjectId(
              userId
            ),

          action:
            input.action,

          selectedSide:
            input.action ===
              "share"
              ? null
              : input.selectedSide,

          note:
            input.note
              ?.trim() ||
            null,

          match: {
            sources:
              input.match
                .sources,

            kickoffAt:
              new Date(
                input.match
                  .kickoffAt
              ),

            competitionName:
              input.match
                .competitionName,

            country:
              input.match
                .country,

            homeName:
              input.match
                .homeName
                .trim(),

            awayName:
              input.match
                .awayName
                .trim(),

            homeGoals:
              input.match
                .homeGoals,

            awayGoals:
              input.match
                .awayGoals,

            minute:
              input.match
                .minute,
          },

          expiresAt:
            getExpirationDate(
              input.match
                .kickoffAt
            ),
        });

		return {
  insight,

  memberIds:
    group.memberIds.map(
      memberId =>
        String(
          memberId
        )
    ),
};
  }

  public async getRecent(
    userId:
      string
  ) {
    const group =
      await this.getMyGroup(
        userId
      );

    if (!group) {
      return [];
    }

    const insights =
      await SharedMatchInsightModel
        .find({
          groupId:
            group._id,

          expiresAt: {
            $gt:
              new Date(),
          },
        })
        .sort({
          createdAt:
            -1,
        })
        .limit(
          50
        )
        .lean();

    const userIds =
      Array.from(
        new Set(
          insights.map(
            item =>
              String(
                item.createdBy
              )
          )
        )
      );

    const users =
      await RadarUserModel
        .find({
          _id: {
            $in:
              userIds,
          },
        })
        .select(
          "_id username"
        )
        .lean();

    const usernames =
      new Map(
        users.map(
          user => [
            String(
              user._id
            ),
            user.username,
          ]
        )
      );

    return insights.map(
      item => ({
        ...item,

        createdByUser: {
          id:
            String(
              item.createdBy
            ),

          username:
            usernames.get(
              String(
                item.createdBy
              )
            ) ??
            "Usuario",
        },
      })
    );
  }
}
