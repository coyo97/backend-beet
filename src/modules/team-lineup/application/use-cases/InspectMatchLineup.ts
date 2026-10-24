import type {
  BootstrapTeamLineupHistoryResult,
} from "./BootstrapTeamLineupHistory";

import {
  BootstrapTeamLineupHistory,
} from "./BootstrapTeamLineupHistory";

import {
  AnalyzeMatchLineup,
} from "./AnalyzeMatchLineup";

import {
  VerifyMatchLineup,
} from "./VerifyMatchLineup";

export interface InspectMatchLineupInput {
  provider:
    string;

  externalId:
    string;

  bootstrapHistory?:
    boolean;

  historyLimit?:
    number;
}

export class InspectMatchLineup {
  private readonly minimumHistoryMatches =
    3;

  constructor(
    private readonly verify:
      VerifyMatchLineup,

    private readonly analyze:
      AnalyzeMatchLineup,

    private readonly bootstrap:
      BootstrapTeamLineupHistory
  ) {}

  public async execute(
    input:
      InspectMatchLineupInput
  ) {

    const historyLimit =
      Math.min(
        Math.max(
          Number.isFinite(
            input.historyLimit
          )
            ? Number(
                input.historyLimit
              )
            : 5,
          3
        ),
        8
      );

    /*
     * Primero buscamos Mongo.
     *
     * Flashscore solamente se consulta
     * cuando todavía no tenemos una
     * alineación confirmada.
     */
    const verification =
      await this.verify
        .execute({
          provider:
            input.provider,

          externalId:
            input.externalId,
        });

    let analysis =
      await this.analyze
        .execute({
          lineup:
            verification.lineup,

          historyLimit,
        });

    let homeBootstrap:
      BootstrapTeamLineupHistoryResult |
      null =
        null;

    let awayBootstrap:
      BootstrapTeamLineupHistoryResult |
      null =
        null;

    /*
     * El bootstrap histórico nunca se
     * ejecuta automáticamente.
     *
     * Tiene que venir explícitamente:
     *
     * bootstrapHistory: true
     */
    if (
      input.bootstrapHistory ===
        true &&
      verification.lineup
        .status ===
        "confirmed"
    ) {

      /*
       * Una vez que tenemos 3 partidos
       * históricos ya podemos clasificar
       * rotación.
       *
       * No seguimos gastando peticiones
       * automáticamente para llegar a 5/8.
       */
      if (
        verification.lineup
          .home
          .teamId &&
        analysis.home
          .historicalMatches <
          this.minimumHistoryMatches
      ) {

        homeBootstrap =
          await this.bootstrap
            .execute({
              provider:
                verification
                  .lineup
                  .provider,

              teamId:
                verification
                  .lineup
                  .home
                  .teamId,

              limit:
                historyLimit,

              excludeSourceKey:
                verification
                  .lineup
                  .sourceKey,
            });
      }

      if (
        verification.lineup
          .away
          .teamId &&
        analysis.away
          .historicalMatches <
          this.minimumHistoryMatches
      ) {

        awayBootstrap =
          await this.bootstrap
            .execute({
              provider:
                verification
                  .lineup
                  .provider,

              teamId:
                verification
                  .lineup
                  .away
                  .teamId,

              limit:
                historyLimit,

              excludeSourceKey:
                verification
                  .lineup
                  .sourceKey,
            });
      }

      /*
       * Si cargamos algún histórico nuevo,
       * recalculamos después del bootstrap.
       */
      if (
        homeBootstrap ||
        awayBootstrap
      ) {

        analysis =
          await this.analyze
            .execute({
              lineup:
                verification
                  .lineup,

              historyLimit,
            });
      }
    }

    return {
      lineupSource:
        verification.source,

      lineup:
        verification.lineup,

      analysis,

      history: {
        bootstrapRequested:
          input.bootstrapHistory ===
          true,

        minimumMatches:
          this.minimumHistoryMatches,

        historyLimit,

        homeBootstrap,

        awayBootstrap,
      },
    };
  }
}
