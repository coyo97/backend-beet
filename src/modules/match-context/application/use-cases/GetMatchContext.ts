import type {
  MatchContextProvider,
} from "../ports/MatchContextProvider";

import type {
  MatchContext,
} from "../../domain/entities/MatchContext";

import type {
  MatchContextFallbackResolver,
  MatchContextRequestMetadata,
} from "../ports/MatchContextFallbackResolver";

interface CacheEntry {
  expiresAt:
    number;

  context:
    MatchContext;
}

export class GetMatchContext {
  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  constructor(
    private readonly providers:
      MatchContextProvider[],

    private readonly ttlMs =
      120_000,

    private readonly fallbackResolver?:
      MatchContextFallbackResolver
  ) {}

  public async execute(
    provider:
      string,

    externalId:
      string,

    metadata?:
      MatchContextRequestMetadata
  ): Promise<
    MatchContext
  > {

    const key =
      `${provider}:${externalId}`;

    const cached =
      this.cache.get(
        key
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.context;
    }

    /*
     * Primero mantenemos exactamente
     * el comportamiento existente:
     * Flashscore / FotMob.
     */
    const implementation =
      this.providers.find(
        (
          item
        ) =>
          item.supports(
            provider
          )
      );

    if (implementation) {
      const context =
        await implementation
          .getContext(
            externalId
          );

      this.cache.set(
        key,
        {
          context,

          expiresAt:
            Date.now() +
            this.ttlMs,
        }
      );

      return context;
    }

    /*
     * Si no existe provider directo,
     * podemos intentar una fuente externa
     * registrada usando metadata del partido.
     */
    if (
      this.fallbackResolver &&
      metadata
    ) {
      const context =
        await this
          .fallbackResolver
          .resolve({
            provider,
            externalId,

			competitionId:
  metadata.competitionId,
            competitionName:
              metadata.competitionName,

            country:
              metadata.country,

            homeName:
              metadata.homeName,

            awayName:
              metadata.awayName,
          });

      if (context) {
        this.cache.set(
          key,
          {
            context,

            expiresAt:
              Date.now() +
              this.ttlMs,
          }
        );

        return context;
      }
    }

    throw new Error(
      `Match context unavailable for ${provider}:${externalId}`
    );
  }
}
