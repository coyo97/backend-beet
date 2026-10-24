import type {
  MatchSource,
} from "../../domain/entities/LiveMatch";

import type {
  MatchIncident,
} from "../../domain/entities/MatchIncident";

import type {
  MatchIncidentProvider,
} from "../../domain/providers/MatchIncidentProvider";

interface CacheEntry {
  items:
    MatchIncident[];

  expiresAt:
    number;

  staleUntil:
    number;
}

interface Options {
  ttlMs:
    number;

  staleIfErrorMs:
    number;

  isEnabled?:
    () =>
      Promise<boolean>;
}

export class CachedMatchIncidentProvider
  implements MatchIncidentProvider
{
  private readonly cache =
    new Map<
      string,
      CacheEntry
    >();

  private readonly inflight =
    new Map<
      string,
      Promise<
        MatchIncident[]
      >
    >();

  constructor(
    private readonly provider:
      MatchIncidentProvider,

    private readonly options:
      Options
  ) {}

  public supports(
    source:
      MatchSource
  ): boolean {

    return this.provider
      .supports(
        source
      );
  }

  public async getIncidents(
    source:
      MatchSource
  ): Promise<
    MatchIncident[]
  > {

    if (
      !this.supports(
        source
      )
    ) {
      return [];
    }

    if (
      this.options
        .isEnabled &&
      !(
        await this.options
          .isEnabled()
      )
    ) {
      this.invalidate(
        source
      );

      return [];
    }

    const key =
      this.key(
        source
      );

    const now =
      Date.now();

    const cached =
      this.cache.get(
        key
      );

    if (
      cached &&
      cached.expiresAt >
        now
    ) {
      return cached.items;
    }

    const running =
      this.inflight.get(
        key
      );

    if (running) {
      return running;
    }

    const request =
      this.load(
        source,
        cached
      );

    this.inflight.set(
      key,
      request
    );

    try {
      return await request;

    } finally {

      if (
        this.inflight.get(
          key
        ) ===
        request
      ) {
        this.inflight.delete(
          key
        );
      }
    }
  }

  public invalidate(
    source?:
      MatchSource
  ): void {

    if (!source) {
      this.cache.clear();
      this.inflight.clear();

      return;
    }

    const key =
      this.key(
        source
      );

    this.cache.delete(
      key
    );

    this.inflight.delete(
      key
    );
  }

  private async load(
    source:
      MatchSource,

    previous:
      CacheEntry |
      undefined
  ): Promise<
    MatchIncident[]
  > {

    try {
      const items =
        await this.provider
          .getIncidents(
            source
          );

      const now =
        Date.now();

      this.cache.set(
        this.key(
          source
        ),
        {
          items,

          expiresAt:
            now +
            this.options
              .ttlMs,

          staleUntil:
            now +
            this.options
              .ttlMs +
            this.options
              .staleIfErrorMs,
        }
      );

      return items;

    } catch (
      error
    ) {

      if (
        previous &&
        previous.staleUntil >
          Date.now()
      ) {
        return previous.items;
      }

      throw error;
    }
  }

  private key(
    source:
      MatchSource
  ): string {

    return (
      `${source.provider}:` +
      source.externalId
    );
  }
}
