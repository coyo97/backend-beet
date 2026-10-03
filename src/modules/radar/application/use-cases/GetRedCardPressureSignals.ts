import type {
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  RedCardRadarMatch,
} from "../../domain/entities/RedCardRadarMatch";

import type {
  AnalyzeMatchPressure,
} from "./AnalyzeMatchPressure";

import type {
  RedCardPressureSignal,
} from "../../domain/entities/RedCardPressureSignal";

import {
  RedCardPressureScanner,
} from "../../domain/services/RedCardPressureScanner";

export interface RedCardPressureFilters {
  country?: string;
}

export interface RedCardMatchesSource {
  execute(
    filters?:
      RedCardPressureFilters
  ): Promise<
    RedCardRadarMatch[]
  >;
}

export class GetRedCardPressureSignals {
  constructor(
    private readonly getRedCardMatches:
      RedCardMatchesSource,

    private readonly analyzeMatchPressure:
      AnalyzeMatchPressure,

    private readonly scanner:
      RedCardPressureScanner =
        new RedCardPressureScanner()
  ) {}

  public async execute(
    filters:
      RedCardPressureFilters = {}
  ): Promise<
    RedCardPressureSignal[]
  > {

    const redCardMatches =
      await this
        .getRedCardMatches
        .execute({
          country:
            filters.country,
        });

    const signals:
      RedCardPressureSignal[] =
        [];

    /*
     * Mantenemos la concurrencia
     * original.
     */
    const concurrency =
      3;

    for (
      let index =
        0;

      index <
        redCardMatches.length;

      index +=
        concurrency
    ) {

      const chunk =
        redCardMatches.slice(
          index,
          index +
            concurrency
        );

      const results =
        await Promise.all(
          chunk.map(
            (
              match
            ) =>
              this.scanMatch(
                match
              )
          )
        );

      for (
        const signal
        of results
      ) {

        if (signal) {
          signals.push(
            signal
          );
        }
      }
    }

    return signals;
  }

  private async scanMatch(
    radarMatch:
      RedCardRadarMatch
  ): Promise<
    RedCardPressureSignal |
    null
  > {

    /*
     * Antes solo buscábamos Flashscore.
     *
     * Ahora intentamos todas las
     * fuentes capaces de aportar
     * estadísticas de presión.
     */
    const sources =
      this.findPressureSources(
        radarMatch.match
          .sources
      );

    if (
      sources.length ===
      0
    ) {
      /*
       * Caso típico:
       * partido exclusivo de 1xBet.
       *
       * Tenemos roja, pero todavía
       * no tenemos estadísticas para
       * calcular presión.
       */
      return null;
    }

    for (
      const source
      of sources
    ) {

      try {

        const pressure =
          await this
            .analyzeMatchPressure
            .execute(
              source
            );

        if (!pressure) {
          continue;
        }

        return this.scanner
          .scan(
            radarMatch,
            pressure
          );

      } catch (
        error
      ) {

        /*
         * Una fuente no compatible
         * no impide intentar la siguiente.
         */
        console.warn(
          "[GetRedCardPressureSignals]",
          source.provider,
          source.externalId,

          error instanceof
            Error
            ? error.message
            : error
        );
      }
    }

    return null;
  }

  private findPressureSources(
    sources:
      MatchSource[]
  ): MatchSource[] {

    /*
     * Conservamos Flashscore como
     * primera opción porque ya está
     * probado.
     *
     * Después intentamos FotMob y
     * API-Football.
     *
     * Bookmaker NO entra todavía:
     * 1xBet nos descubre el partido
     * y puede confirmar la roja,
     * pero aún no implementamos
     * estadísticas de presión 1xBet.
     */
    const priority = [
      "flashscore",
      "fotmob",
      "api-football",
    ] as const;

    const result:
      MatchSource[] =
        [];

    for (
      const provider
      of priority
    ) {

      const source =
        sources.find(
          (
            item
          ) =>
            item.provider ===
            provider
        );

      if (source) {
        result.push(
          source
        );
      }
    }

    return result;
  }
}
