import type {
  CreateTeamMemoryEventInput,
  TeamMemoryEvent,
  TeamMemorySummary,
} from "../../domain/entities/TeamMemory";

import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

import {
  normalizeTeamName,
} from "../../domain/services/normalizeTeamName";

import {
  TeamMemoryEventModel,
  type TeamMemoryEventDocument,
} from "../database/models/TeamMemoryEventModel";

export class MongooseTeamMemoryRepository
  implements TeamMemoryRepository
{
public async create(
  ownerId:
    string,

  input:
    CreateTeamMemoryEventInput
): Promise<
    TeamMemoryEvent
  > {

    const document =
      await TeamMemoryEventModel
        .create({
			          ownerId:
            ownerId.trim(),
          teamName:
            input.teamName
              .trim(),

          teamKey:
            normalizeTeamName(
              input.teamName
            ),

          outcome:
            input.outcome,

          opponentName:
            input.opponentName
              ?.trim() ||
            null,

          competitionName:
            input.competitionName
              ?.trim() ||
            null,

          kickoffAt:
            input.kickoffAt
              ? new Date(
                  input.kickoffAt
                )
              : null,

          provider:
            input.provider ??
            null,

          externalId:
            input.externalId ??
            null,

          note:
            input.note ??
            null,
        });

    return this.toDomain(
      document
    );
  }

public async summaries(
  ownerId:
    string,

  teamNames:
    string[]
): Promise<
    TeamMemorySummary[]
  > {

    const unique =
      Array.from(
        new Map(
          teamNames
            .filter(
              Boolean
            )
            .map(
              (
                name
              ) => [
                normalizeTeamName(
                  name
                ),
                name.trim(),
              ]
            )
        )
      );

    const keys =
      unique.map(
        (
          [
            key,
          ]
        ) =>
          key
      );

    const documents =
      await TeamMemoryEventModel
        .find({
  ownerId:
    ownerId.trim(),

  teamKey: {
    $in:
      keys,
  },
})
        .sort({
          createdAt:
            -1,
        })
        .exec();

    const grouped =
      new Map<
        string,
        TeamMemoryEventDocument[]
      >();

    for (
      const document
      of documents
    ) {

      const list =
        grouped.get(
          document.teamKey
        ) ??
        [];

      list.push(
        document
      );

      grouped.set(
        document.teamKey,
        list
      );
    }

    return unique.map(
      (
        [
          key,
          requestedName,
        ]
      ) => {

        const items =
          grouped.get(
            key
          ) ??
          [];

        const wins =
          items.filter(
            (
              item
            ) =>
              item.outcome ===
              "win"
          ).length;

        const losses =
          items.filter(
            (
              item
            ) =>
              item.outcome ===
              "loss"
          ).length;

        const latest =
          items[0] ??
          null;

        return {
          teamName:
            latest
              ?.teamName ??
            requestedName,

          wins,

          losses,

          total:
            wins +
            losses,

          balance:
            wins -
            losses,

          lastOutcome:
            latest
              ?.outcome ??
            null,

          lastUpdatedAt:
            latest
              ?.createdAt
              .toISOString() ??
            null,
        };
      }
    );
  }

public async findByTeam(
  ownerId:
    string,

  teamName:
    string,

  limit =
    20
): Promise<
    TeamMemoryEvent[]
  > {

    const documents =
      await TeamMemoryEventModel
        .find({
  ownerId:
    ownerId.trim(),

  teamKey:
    normalizeTeamName(
      teamName
    ),
})
        .sort({
          createdAt:
            -1,
        })
        .limit(
          Math.min(
            Math.max(
              limit,
              1
            ),
            100
          )
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

public async deleteById(
  ownerId:
    string,

  id:
    string
): Promise<
    TeamMemoryEvent |
    null
  > {

    if (
      !id ||
      !/^[a-f\d]{24}$/i.test(
        id
      )
    ) {
      return null;
    }

    const document =
      await TeamMemoryEventModel
        .findOneAndDelete({
  _id:
    id,

  ownerId:
    ownerId.trim(),
})
        .exec();

    return document
      ? this.toDomain(
          document
        )
      : null;
  }

  private toDomain(
    document:
      TeamMemoryEventDocument
  ): TeamMemoryEvent {

    return {
      id:
        String(
          document._id
        ),

      teamName:
        document.teamName,

      teamKey:
        document.teamKey,

      outcome:
        document.outcome,

      opponentName:
        document.opponentName ??
        null,

      competitionName:
        document.competitionName ??
        null,

      kickoffAt:
        document.kickoffAt
          ?.toISOString() ??
        null,

      provider:
        document.provider,

      externalId:
        document.externalId,

      note:
        document.note,

      createdAt:
        document.createdAt
          .toISOString(),
    };
  }
  public async allSummaries(
  ownerId:
    string
): Promise<
  TeamMemorySummary[]
> {

  interface Row {
    teamName:
      string;

    wins:
      number;

    losses:
      number;

    total:
      number;

    balance:
      number;

    lastOutcome:
      "win" |
      "loss" |
      null;

    lastUpdatedAt:
      Date |
      null;
  }

  const rows =
    await TeamMemoryEventModel
      .aggregate<Row>([
        {
          $match: {
            ownerId:
              ownerId.trim(),
          },
        },

        {
          $sort: {
            createdAt:
              -1,
          },
        },

        {
          $group: {
            _id:
              "$teamKey",

            teamName: {
              $first:
                "$teamName",
            },

            wins: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$outcome",
                      "win",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            losses: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$outcome",
                      "loss",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            lastOutcome: {
              $first:
                "$outcome",
            },

            lastUpdatedAt: {
              $first:
                "$createdAt",
            },
          },
        },

        {
          $addFields: {
            total: {
              $add: [
                "$wins",
                "$losses",
              ],
            },

            balance: {
              $subtract: [
                "$wins",
                "$losses",
              ],
            },
          },
        },

        {
          $sort: {
            lastUpdatedAt:
              -1,
          },
        },

        {
          $project: {
            _id:
              0,

            teamName:
              1,

            wins:
              1,

            losses:
              1,

            total:
              1,

            balance:
              1,

            lastOutcome:
              1,

            lastUpdatedAt:
              1,
          },
        },
      ])
      .exec();

  return rows.map(
    row => ({
      teamName:
        row.teamName,

      wins:
        row.wins,

      losses:
        row.losses,

      total:
        row.total,

      balance:
        row.balance,

      lastOutcome:
        row.lastOutcome,

      lastUpdatedAt:
        row.lastUpdatedAt
          ?.toISOString() ??
        null,
    })
  );
}
}
