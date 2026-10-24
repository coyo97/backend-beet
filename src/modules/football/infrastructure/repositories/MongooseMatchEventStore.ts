import type {
  MatchEventSnapshot,
} from "../../domain/entities/MatchEventSnapshot";

import type {
  MatchEventStore,
} from "../../application/ports/MatchEventStore";

import {
  MatchEventSnapshotModel,
} from "../database/models/MatchEventSnapshotModel";

export class MongooseMatchEventStore
  implements MatchEventStore
{
  public async upsert(
    snapshot:
      MatchEventSnapshot
  ): Promise<void> {

    /*
     * Un mismo partido puede llegar desde
     * varias fuentes.
     *
     * Antes de crear otro documento,
     * buscamos si ya conocemos cualquiera
     * de sus sourceKeys.
     */
    const existing =
      await MatchEventSnapshotModel
        .findOne({
          sourceKeys: {
            $in:
              snapshot.sourceKeys,
          },
        })
        .select({
          _id:
            1,

          firstCapturedAt:
            1,
        })
        .exec();

    const capturedAt =
      new Date(
        snapshot.capturedAt
      );

    const set = {
      incidentSource: {
        provider:
          snapshot
            .incidentSource
            .provider,

        externalId:
          snapshot
            .incidentSource
            .externalId,
      },

      kickoffAt:
        new Date(
          snapshot.kickoffAt
        ),

      status:
        snapshot.status,

      competition:
        snapshot.competition,

      home:
        snapshot.home,

      away:
        snapshot.away,

      incidents:
        snapshot.incidents,

      lastCapturedAt:
        capturedAt,
    };

    if (existing) {

      await MatchEventSnapshotModel
        .updateOne(
          {
            _id:
              existing._id,
          },
          {
            $set:
              set,

            $addToSet: {
              sourceKeys: {
                $each:
                  snapshot.sourceKeys,
              },
            },
          }
        )
        .exec();

      return;
    }

    await MatchEventSnapshotModel
      .create({
        sourceKeys:
          snapshot.sourceKeys,

        ...set,

        firstCapturedAt:
          capturedAt,
      });
  }
    public async findByTeam(
    teamName:
      string,

    limit =
      50
  ): Promise<
    MatchEventSnapshot[]
  > {

    const normalizedLimit =
      Math.min(
        Math.max(
          limit,
          1
        ),
        500
      );

    const documents =
      await MatchEventSnapshotModel
        .find({
          $or: [
            {
              "home.name":
                teamName,
            },
            {
              "away.name":
                teamName,
            },
          ],
        })
        .sort({
          kickoffAt:
            -1,
        })
        .limit(
          normalizedLimit
        )
        .lean()
        .exec();

    return documents.map(
      document => ({
        sourceKeys:
          document.sourceKeys,

        incidentSource: {
          provider:
            document
              .incidentSource
              .provider as
              MatchEventSnapshot[
                "incidentSource"
              ][
                "provider"
              ],

          externalId:
            document
              .incidentSource
              .externalId,
        },

        kickoffAt:
          document
            .kickoffAt
            .toISOString(),

        status:
          document.status,

        competition:
          document.competition,

        home:
          document.home,

        away:
          document.away,

        incidents:
          document
            .incidents,

        /*
         * El documento representa su
         * última captura conocida.
         */
        capturedAt:
          document
            .lastCapturedAt
            .toISOString(),
      })
    );
  }
    public async findByTeams(
    teamNames:
      string[],

    limitPerTeam =
      50
  ): Promise<
    MatchEventSnapshot[]
  > {

    const names =
      Array.from(
        new Set(
          teamNames
            .map(
              name =>
                name.trim()
            )
            .filter(
              Boolean
            )
        )
      );

    if (
      names.length ===
      0
    ) {
      return [];
    }

    const normalizedLimit =
      Math.min(
        Math.max(
          limitPerTeam,
          1
        ),
        500
      );

    /*
     * UNA sola consulta Mongo para
     * todos los equipos.
     */
    const documents =
      await MatchEventSnapshotModel
        .find({
          $or: [
            {
              "home.name": {
                $in:
                  names,
              },
            },
            {
              "away.name": {
                $in:
                  names,
              },
            },
          ],
        })
        .sort({
          kickoffAt:
            -1,
        })
        .lean()
        .exec();

    /*
     * Mongo ya nos devolvió todo
     * ordenado de reciente a antiguo.
     *
     * Aquí aplicamos el límite POR
     * EQUIPO localmente.
     */
    const counts =
      new Map<
        string,
        number
      >(
        names.map(
          name => [
            name,
            0,
          ]
        )
      );

    const selected =
      documents.filter(
        document => {

          let include =
            false;

          const participants =
            [
              document
                .home
                .name,

              document
                .away
                .name,
            ];

          for (
            const participant
            of participants
          ) {

            const current =
              counts.get(
                participant
              );

            if (
              current ===
                undefined ||
              current >=
                normalizedLimit
            ) {
              continue;
            }

            counts.set(
              participant,
              current +
                1
            );

            include =
              true;
          }

          return include;
        }
      );

    return selected.map(
      document => ({
        sourceKeys:
          document.sourceKeys,

        incidentSource: {
          provider:
            document
              .incidentSource
              .provider as
              MatchEventSnapshot[
                "incidentSource"
              ][
                "provider"
              ],

          externalId:
            document
              .incidentSource
              .externalId,
        },

        kickoffAt:
          document
            .kickoffAt
            .toISOString(),

        status:
          document.status,

        competition:
          document.competition,

        home:
          document.home,

        away:
          document.away,

        incidents:
          document.incidents,

        capturedAt:
          document
            .lastCapturedAt
            .toISOString(),
      })
    );
  }
}
