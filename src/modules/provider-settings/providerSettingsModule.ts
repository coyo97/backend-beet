import {
  MongooseFootballProviderSettingsRepository,
} from "./infrastructure/repositories/MongooseFootballProviderSettingsRepository";

import {
  FootballProviderSettingsService,
} from "./application/services/FootballProviderSettingsService";

import {
  GetFootballProviderSettings,
} from "./application/use-cases/GetFootballProviderSettings";

import {
  SetFootballProviderEnabled,
} from "./application/use-cases/SetFootballProviderEnabled";

import {
  FootballProviderSettingsController,
} from "./presentation/controllers/FootballProviderSettingsController";

import {
  createFootballProviderSettingsRouter,
} from "./presentation/routes/footballProviderSettingsRoutes";

const repository =
  new MongooseFootballProviderSettingsRepository();

export const footballProviderSettingsService =
  new FootballProviderSettingsService(
    repository,
    {
      sofascore:
        process.env
          .SOFASCORE_LIVE_ENABLED !==
        "false",

      flashscore:
        true,

      fotmob:
        process.env
          .FOTMOB_ENRICH_ENABLED !==
        "false",

      "api-football":
        true,

      "1xbet":
        process.env
          .ONEXBET_LIVE_ENABLED !==
        "false",
    }
  );

const getSettings =
  new GetFootballProviderSettings(
    footballProviderSettingsService
  );

const setEnabled =
  new SetFootballProviderEnabled(
    footballProviderSettingsService
  );

const controller =
  new FootballProviderSettingsController(
    getSettings,
    setEnabled
  );

export const footballProviderSettingsRouter =
  createFootballProviderSettingsRouter(
    controller
  );
