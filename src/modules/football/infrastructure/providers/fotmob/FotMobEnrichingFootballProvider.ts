import type {
  FootballProvider,
} from "../../../domain/providers/FootballProvider";

import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import {
  FotMobMatchResolver,
} from "./FotMobMatchResolver";

export class FotMobEnrichingFootballProvider
  implements FootballProvider
{
  constructor(
    private readonly baseProvider:
      FootballProvider,

    private readonly resolver:
      FotMobMatchResolver
  ) {}

  public async getLiveMatches():
    Promise<
      LiveMatch[]
    > {

    /*
     * Primero obtenemos EXACTAMENTE
     * lo que ya funcionaba.
     */
    const matches =
      await this.baseProvider
        .getLiveMatches();

    /*
     * Luego enriquecemos.
     *
     * Si FotMob falla no modificamos
     * el resultado original.
     */
    return Promise.all(
      matches.map(
        (
          match
        ) =>
          this.enrich(
            match
          )
      )
    );
  }

  private async enrich(
    match:
      LiveMatch
  ): Promise<
    LiveMatch
  > {

    /*
     * Ya tiene FotMob.
     * No hacemos nada.
     */
    if (
      match.sources.some(
        (
          source
        ) =>
          source.provider ===
          "fotmob"
      )
    ) {
      return match;
    }

    /*
     * Primera versión:
     *
     * enriquecemos especialmente los
     * partidos descubiertos por 1xBet.
     *
     * No alteramos el flujo Flashscore.
     */
       try {
      const resolved =
        await this.resolver
          .resolve(
            match
          );

      if (!resolved) {
        return match;
      }

      return {
        ...match,

        sources: [
          ...match.sources,

          {
            provider:
              "fotmob",

            externalId:
              resolved.externalId,
          },
        ],
      };
    } catch (
      error
    ) {

      /*
       * FotMob JAMÁS puede impedir
       * que el partido aparezca.
       */
      return match;
    }
  }
}
