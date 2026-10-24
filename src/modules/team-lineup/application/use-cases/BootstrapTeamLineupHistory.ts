import type {
  MatchLineupProvider,
} from "../ports/MatchLineupProvider";

import type {
  MatchLineupStore,
} from "../ports/MatchLineupStore";

import type {
  TeamMatchHistoryCatalog,
} from "../ports/TeamMatchHistoryCatalog";

export interface BootstrapTeamLineupHistoryInput {
  provider:
    string;

  teamId:
    string;

  limit?:
    number;

  excludeSourceKey?:
    string;
}

export interface BootstrapTeamLineupHistoryResult {
  teamId:
    string;

  requested:
    number;

  discovered:
    number;

  saved:
    number;

  reused:
    number;

  skipped:
    number;

  failed:
    number;

  sourceKeys:
    string[];
}

export class BootstrapTeamLineupHistory {
  constructor(
    private readonly catalog:
      TeamMatchHistoryCatalog,

    private readonly lineupProvider:
      MatchLineupProvider,

    private readonly store:
      MatchLineupStore
  ) {}

  public async execute(
    input:
      BootstrapTeamLineupHistoryInput
  ): Promise<
    BootstrapTeamLineupHistoryResult
  > {

    const teamId =
      input.teamId
        .trim();

    if (!teamId) {
      throw new Error(
        "teamId is required"
      );
    }

    const limit =
      Math.min(
        Math.max(
          Number.isFinite(
            input.limit
          )
            ? Number(
                input.limit
              )
            : 5,
          1
        ),
        8
      );

    const matches =
      await this.catalog
        .listRecentFinished({
          provider:
            input.provider,

          teamId,

          limit,

          excludeSourceKey:
            input
              .excludeSourceKey,
        });

    let saved =
      0;

    let reused =
      0;

    let skipped =
      0;

    let failed =
      0;

    const sourceKeys:
      string[] =
        [];

    /*
     * Intencionalmente secuencial.
     *
     * No queremos lanzar ocho consultas
     * simultáneas contra Flashscore.
     */
    for (
      const match
      of matches
    ) {

      sourceKeys.push(
        match.sourceKey
      );

      try {

        const cached =
          await this.store
            .findBySourceKey(
              match.sourceKey
            );

        if (
          cached?.status ===
          "confirmed"
        ) {
          reused +=
            1;

          continue;
        }

        const lineup =
          await this
            .lineupProvider
            .getLineup(
              match.provider,
              match.externalId
            );

        /*
         * Para construir historial solo
         * aceptamos partidos completos:
         *
         * 11 titulares local
         * 11 titulares visitante.
         */
        if (
          lineup.status !==
          "confirmed"
        ) {
          skipped +=
            1;

          continue;
        }

        await this.store
          .upsert(
            lineup
          );

        saved +=
          1;

      } catch (
        error
      ) {

        failed +=
          1;

        console.warn(
          "[BootstrapTeamLineupHistory]",
          match.sourceKey,
          error instanceof Error
            ? error.message
            : error
        );
      }
    }

    return {
      teamId,

      requested:
        limit,

      discovered:
        matches.length,

      saved,

      reused,

      skipped,

      failed,

      sourceKeys,
    };
  }
}
