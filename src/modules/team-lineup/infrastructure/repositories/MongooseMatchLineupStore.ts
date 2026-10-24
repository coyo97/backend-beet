import type {
  MatchLineupSnapshot,
} from "../../domain/entities/MatchLineupSnapshot";

import type {
  FindRecentTeamLineupsInput,
  MatchLineupStore,
} from "../../application/ports/MatchLineupStore";

import {
  MatchLineupSnapshotModel,
  type MatchLineupSnapshotDocument,
} from "../database/models/MatchLineupSnapshotModel";

export class MongooseMatchLineupStore
  implements MatchLineupStore
{
  public async findBySourceKey(
    sourceKey:
      string
  ): Promise<
    MatchLineupSnapshot |
    null
  > {

    const document =
      await MatchLineupSnapshotModel
        .findOne({
          sourceKey,
        })
        .exec();

    return document
      ? this.toDomain(
          document
        )
      : null;
  }

  public async upsert(
    snapshot:
      MatchLineupSnapshot
  ): Promise<
    MatchLineupSnapshot
  > {

    /*
     * No degradamos una alineación
     * confirmada a partial/unavailable.
     */
    const existing =
      await MatchLineupSnapshotModel
        .findOne({
          sourceKey:
            snapshot.sourceKey,
        })
        .exec();

    if (
      existing &&
      existing.status ===
        "confirmed" &&
      snapshot.status !==
        "confirmed"
    ) {
      return this.toDomain(
        existing
      );
    }

    const document =
      await MatchLineupSnapshotModel
        .findOneAndUpdate(
          {
            sourceKey:
              snapshot.sourceKey,
          },

          {
            $set: {
              provider:
                snapshot.provider,

              externalId:
                snapshot.externalId,

              sourceKey:
                snapshot.sourceKey,

              kickoffAt:
                snapshot.kickoffAt
                  ? new Date(
                      snapshot.kickoffAt
                    )
                  : null,

              status:
                snapshot.status,

              home:
                snapshot.home,

              away:
                snapshot.away,

              fetchedAt:
                new Date(
                  snapshot.fetchedAt
                ),
            },
          },

         {
  upsert:
    true,

  returnDocument:
    "after",

  setDefaultsOnInsert:
    true,
}
        )
        .exec();

    if (!document) {
      throw new Error(
        "Could not save match lineup snapshot"
      );
    }

    return this.toDomain(
      document
    );
  }

  public async findRecentConfirmedByTeam(
    input:
      FindRecentTeamLineupsInput
  ): Promise<
    MatchLineupSnapshot[]
  > {

    const limit =
      Math.min(
        Math.max(
          Number.isFinite(
            input.limit
          )
            ? Number(
                input.limit
              )
            : 8,
          1
        ),
        30
      );

    const filters:
      Record<
        string,
        unknown
      > = {
        provider:
          input.provider,

        status:
          "confirmed",

        $or: [
          {
            "home.teamId":
              input.teamId,
          },
          {
            "away.teamId":
              input.teamId,
          },
        ],
      };

    if (
      input.excludeSourceKey
    ) {
      filters.sourceKey = {
        $ne:
          input.excludeSourceKey,
      };
    }

    const documents =
      await MatchLineupSnapshotModel
        .find(
          filters
        )
        .sort({
          kickoffAt:
            -1,
        })
        .limit(
          limit
        )
        .exec();

    return documents.map(
      document =>
        this.toDomain(
          document
        )
    );
  }

  private toDomain(
    document:
      MatchLineupSnapshotDocument
  ): MatchLineupSnapshot {

    return {
      provider:
        document.provider,

      externalId:
        document.externalId,

      sourceKey:
        document.sourceKey,

      kickoffAt:
        document.kickoffAt
          ?.toISOString() ??
        null,

      status:
        document.status,

      home: {
        teamId:
          document.home
            .teamId ??
          null,

        teamName:
          document.home
            .teamName,

        starters:
          document.home
            .starters
            .map(
              player => ({
                playerId:
                  player.playerId ??
                  null,

                name:
                  player.name,

                position:
                  player.position ??
                  null,

                isGoalkeeper:
                  player.isGoalkeeper,
              })
            ),

        substitutes:
          document.home
            .substitutes
            .map(
              player => ({
                playerId:
                  player.playerId ??
                  null,

                name:
                  player.name,

                position:
                  player.position ??
                  null,

                isGoalkeeper:
                  player.isGoalkeeper,
              })
            ),
      },

      away: {
        teamId:
          document.away
            .teamId ??
          null,

        teamName:
          document.away
            .teamName,

        starters:
          document.away
            .starters
            .map(
              player => ({
                playerId:
                  player.playerId ??
                  null,

                name:
                  player.name,

                position:
                  player.position ??
                  null,

                isGoalkeeper:
                  player.isGoalkeeper,
              })
            ),

        substitutes:
          document.away
            .substitutes
            .map(
              player => ({
                playerId:
                  player.playerId ??
                  null,

                name:
                  player.name,

                position:
                  player.position ??
                  null,

                isGoalkeeper:
                  player.isGoalkeeper,
              })
            ),
      },

      fetchedAt:
        document.fetchedAt
          .toISOString(),
    };
  }
}
