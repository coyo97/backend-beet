import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../domain/providers/FootballProvider";

import {
  LiveMatchDeduplicator,
} from "../../domain/services/LiveMatchDeduplicator";

interface ProviderEntry {
  name:
    string;

  provider:
    FootballProvider;

  timeoutMs?:
    number;
}

interface ProviderResult {
  name:
    string;

  matches:
    LiveMatch[];

  stale:
    boolean;

  durationMs:
    number;
}

export class CompositeFootballProvider
  implements FootballProvider
{
  private readonly lastGood =
    new Map<
      string,
      LiveMatch[]
    >();

  constructor(
    private readonly providers:
      ProviderEntry[],

    private readonly deduplicator:
      LiveMatchDeduplicator =
        new LiveMatchDeduplicator(),

    private readonly defaultTimeoutMs =
      7_000
  ) {}

  public async getLiveMatches():
    Promise<
      LiveMatch[]
    > {

    const results =
      await Promise.all(
        this.providers.map(
          entry =>
            this.loadProvider(
              entry
            )
        )
      );

    const matches:
      LiveMatch[] =
      [];

    for (
      const result
      of results
    ) {
      matches.push(
        ...result.matches
      );

      console.log(
        "[CompositeFootballProvider]",
        result.name,
        `matches=${result.matches.length}`,
        `duration=${result.durationMs}ms`,
        result.stale
          ? "STALE"
          : "LIVE"
      );
    }

    return this
      .deduplicator
      .deduplicate(
        matches
      );
  }

  private async loadProvider(
    entry:
      ProviderEntry
  ): Promise<
    ProviderResult
  > {

    const startedAt =
      Date.now();

    const timeoutMs =
      entry.timeoutMs ??
      this.defaultTimeoutMs;

    try {
      const matches =
        await this.withTimeout(
          entry.provider
            .getLiveMatches(),

          timeoutMs,

          entry.name
        );

      this.lastGood.set(
        entry.name,
        matches
      );

      return {
        name:
          entry.name,

        matches,

        stale:
          false,

        durationMs:
          Date.now() -
          startedAt,
      };
    } catch (
      error
    ) {

      const cached =
        this.lastGood.get(
          entry.name
        ) ??
        [];

      console.warn(
        "[CompositeFootballProvider]",
        entry.name,
        error instanceof Error
          ? error.message
          : error,
        cached.length >
          0
          ? `using stale=${cached.length}`
          : "no stale data"
      );

      return {
        name:
          entry.name,

        matches:
          cached,

        stale:
          cached.length >
          0,

        durationMs:
          Date.now() -
          startedAt,
      };
    }
  }

  private withTimeout<T>(
    promise:
      Promise<T>,

    timeoutMs:
      number,

    name:
      string
  ): Promise<T> {

    let timer:
      ReturnType<
        typeof setTimeout
      >;

    const timeout =
      new Promise<
        never
      >(
        (
          _,
          reject
        ) => {

          timer =
            setTimeout(
              () => {
                reject(
                  new Error(
                    `${name} timed out after ${timeoutMs}ms`
                  )
                );
              },
              timeoutMs
            );
        }
      );

    return Promise.race([
      promise,
      timeout,
    ]).finally(
      () => {
        clearTimeout(
          timer
        );
      }
    );
  }
}
