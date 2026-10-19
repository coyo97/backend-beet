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

  isEnabled?:
    () =>
      Promise<boolean>;
}

interface ProviderResult {
  name:
    string;

  matches:
    LiveMatch[];

  failed:
    boolean;

  disabled:
    boolean;

  durationMs:
    number;
}

export class CompositeFootballProvider
  implements FootballProvider
{
  private inflight:
    Promise<LiveMatch[]> |
    null =
      null;

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

    if (
      this.inflight
    ) {
      console.log(
        "[CompositeFootballProvider]",
        "shared-inflight"
      );

      return this.inflight;
    }

    const running =
      this.loadLiveMatches();

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

  private async loadLiveMatches():
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

      const state =
        result.disabled
          ? "DISABLED"
          : result.failed
            ? "FAILED"
            : "LIVE";

      console.log(
        "[CompositeFootballProvider]",
        result.name,
        `matches=${result.matches.length}`,
        `duration=${result.durationMs}ms`,
        state
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

    if (
      !(await this.isEnabled(
        entry
      ))
    ) {
      return this.disabledResult(
        entry.name,
        startedAt
      );
    }

    try {
      const matches =
        await this.withTimeout(
          entry.provider
            .getLiveMatches(),

          entry.timeoutMs ??
            this.defaultTimeoutMs,

          entry.name
        );

      /*
       * Puede apagarse mientras la
       * petición estaba en curso.
       *
       * En ese caso descartamos el
       * resultado antes de publicarlo.
       */
      if (
        !(await this.isEnabled(
          entry
        ))
      ) {
        return this.disabledResult(
          entry.name,
          startedAt
        );
      }

      return {
        name:
          entry.name,

        matches,

        failed:
          false,

        disabled:
          false,

        durationMs:
          Date.now() -
          startedAt,
      };

    } catch (
      error
    ) {

      if (
        !(await this.isEnabled(
          entry
        ))
      ) {
        return this.disabledResult(
          entry.name,
          startedAt
        );
      }

      console.warn(
        "[CompositeFootballProvider]",
        entry.name,
        error instanceof
          Error
          ? error.message
          : error
      );

      /*
       * NO mantenemos aquí otra cache stale.
       *
       * CachedFootballProvider ya tiene
       * TTL + staleIfError.
       */
      return {
        name:
          entry.name,

        matches:
          [],

        failed:
          true,

        disabled:
          false,

        durationMs:
          Date.now() -
          startedAt,
      };
    }
  }

  private async isEnabled(
    entry:
      ProviderEntry
  ): Promise<boolean> {

    if (
      !entry.isEnabled
    ) {
      return true;
    }

    return entry
      .isEnabled();
  }

  private disabledResult(
    name:
      string,

    startedAt:
      number
  ): ProviderResult {

    return {
      name,

      matches:
        [],

      failed:
        false,

      disabled:
        true,

      durationMs:
        Date.now() -
        startedAt,
    };
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

    return Promise
      .race([
        promise,
        timeout,
      ])
      .finally(
        () => {
          clearTimeout(
            timer
          );
        }
      );
  }
}
