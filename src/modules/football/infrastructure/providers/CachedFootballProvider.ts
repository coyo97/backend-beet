import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../domain/providers/FootballProvider";

export interface CachedFootballProviderOptions {
  name: string;

  ttlMs: number;

  staleIfErrorMs:
    number;
}

interface CacheEntry {
  matches:
    LiveMatch[];

  fetchedAt:
    number;
}

export class CachedFootballProvider
  implements FootballProvider
{
  private cache:
    CacheEntry |
    null = null;

    private inflight:
    Promise<LiveMatch[]> |
    null =
      null;

  constructor(
    private readonly provider:
      FootballProvider,

    private readonly options:
      CachedFootballProviderOptions
  ) {}

  public async getLiveMatches():
    Promise<LiveMatch[]> {

    const now =
      Date.now();

    if (
      this.cache &&
      now -
        this.cache.fetchedAt <
        this.options.ttlMs
    ) {
      return this
        .cache
        .matches;
    }

    /*
     * Impide que dos llamadas simultáneas
     * atraviesen la caché vacía y hagan
     * dos requests al upstream.
     */
    if (
      this.inflight
    ) {
      return this.inflight;
    }

    const running =
      this.fetchAndCache();

    this.inflight =
      running;

    try {
      return await running;
    } finally {
      if (
        this.inflight ===
        running
      ) {
        this.inflight =
          null;
      }
    }
  }

  private async fetchAndCache():
    Promise<LiveMatch[]> {

    const now =
      Date.now();

    try {
      const matches =
        await this.provider
          .getLiveMatches();

      this.cache = {
        matches,

        fetchedAt:
          Date.now(),
      };

      return matches;
    } catch (
      error
    ) {
      if (
        this.canUseStale(
          now
        )
      ) {
        console.warn(
          `[CachedFootballProvider:${this.options.name}] upstream failed, using stale cache`
        );

        return this.cache!
          .matches;
      }

      throw error;
    }
  }

  public invalidate():
    void {
    this.cache = null;
  }

  private canUseStale(
    now: number
  ): boolean {
    if (!this.cache) {
      return false;
    }

    return (
      now -
        this.cache.fetchedAt <=
      this.options
        .staleIfErrorMs
    );
  }
}
