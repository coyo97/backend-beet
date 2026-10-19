import {
  FOOTBALL_PROVIDER_KEYS,
  type FootballProviderKey,
  type FootballProviderSettingChanged,
  type FootballProviderState,
  type StoredFootballProviderSetting,
} from "../../domain/entities/FootballProviderSetting";

import type {
  FootballProviderSettingsRepository,
} from "../../domain/repositories/FootballProviderSettingsRepository";

type Defaults =
  Record<
    FootballProviderKey,
    boolean
  >;

type Listener =
  (
    change:
      FootballProviderSettingChanged
  ) => void;

export class FootballProviderSettingsService {

  private loaded =
    false;

  private loading:
    Promise<void> |
    null =
    null;

  private readonly stored =
    new Map<
      FootballProviderKey,
      StoredFootballProviderSetting
    >();

  private readonly listeners =
    new Set<
      Listener
    >();

  constructor(
    private readonly repository:
      FootballProviderSettingsRepository,

    private readonly defaults:
      Defaults
  ) {}

  public async isEnabled(
    key:
      FootballProviderKey
  ): Promise<boolean> {

    await this.ensureLoaded();

    return (
      this.stored
        .get(
          key
        )
        ?.enabled ??
      this.defaults[
        key
      ]
    );
  }

  public async list():
    Promise<
      FootballProviderState[]
    > {

    await this.ensureLoaded();

    return FOOTBALL_PROVIDER_KEYS
      .map(
        key => {

          const stored =
            this.stored.get(
              key
            );

          return {
            key,

            enabled:
              stored
                ?.enabled ??
              this.defaults[
                key
              ],

            source:
              stored
                ? "stored"
                : "default",

            updatedAt:
              stored
                ?.updatedAt ??
              null,
          };
        }
      );
  }

  public async setEnabled(
    key:
      FootballProviderKey,

    enabled:
      boolean
  ): Promise<
    FootballProviderState
  > {

    await this.ensureLoaded();

    const stored =
      await this.repository
        .upsert(
          key,
          enabled
        );

    this.stored.set(
      key,
      stored
    );

    this.emit({
      key,
      enabled,
    });

    return {
      key,

      enabled,

      source:
        "stored",

      updatedAt:
        stored.updatedAt,
    };
  }

  public subscribe(
    listener:
      Listener
  ):
    () => void {

    this.listeners.add(
      listener
    );

    return () => {
      this.listeners.delete(
        listener
      );
    };
  }

  private emit(
    change:
      FootballProviderSettingChanged
  ): void {

    for (
      const listener
      of this.listeners
    ) {
      listener(
        change
      );
    }
  }

  private async ensureLoaded():
    Promise<void> {

    if (
      this.loaded
    ) {
      return;
    }

    if (
      this.loading
    ) {
      return this.loading;
    }

    this.loading =
      this.load();

    try {
      await this.loading;

    } finally {
      this.loading =
        null;
    }
  }

  private async load():
    Promise<void> {

    const items =
      await this.repository
        .findAll();

    this.stored.clear();

    for (
      const item
      of items
    ) {
      this.stored.set(
        item.key,
        item
      );
    }

    this.loaded =
      true;
  }
}
