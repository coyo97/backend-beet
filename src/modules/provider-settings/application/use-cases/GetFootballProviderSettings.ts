import type {
  FootballProviderSettingsService,
} from "../services/FootballProviderSettingsService";

export class GetFootballProviderSettings {

  constructor(
    private readonly service:
      FootballProviderSettingsService
  ) {}

  public execute() {

    return this.service
      .list();
  }
}
