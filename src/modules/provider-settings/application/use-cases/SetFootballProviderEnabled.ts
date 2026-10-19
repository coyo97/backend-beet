import type {
  FootballProviderKey,
} from "../../domain/entities/FootballProviderSetting";

import type {
  FootballProviderSettingsService,
} from "../services/FootballProviderSettingsService";

export class SetFootballProviderEnabled {

  constructor(
    private readonly service:
      FootballProviderSettingsService
  ) {}

  public execute(
    key:
      FootballProviderKey,

    enabled:
      boolean
  ) {

    return this.service
      .setEnabled(
        key,
        enabled
      );
  }
}
