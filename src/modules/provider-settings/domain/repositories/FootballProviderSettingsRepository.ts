import type {
  FootballProviderKey,
  StoredFootballProviderSetting,
} from "../entities/FootballProviderSetting";

export interface FootballProviderSettingsRepository {

  findAll():
    Promise<
      StoredFootballProviderSetting[]
    >;

  upsert(
    key:
      FootballProviderKey,

    enabled:
      boolean
  ):
    Promise<
      StoredFootballProviderSetting
    >;
}
