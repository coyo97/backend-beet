import {
  Router,
} from "express";

import type {
  FootballProviderSettingsController,
} from "../controllers/FootballProviderSettingsController";

export function createFootballProviderSettingsRouter(
  controller:
    FootballProviderSettingsController
): Router {

  const router =
    Router();

  router.get(
    "/",
    controller.list
  );

  router.patch(
    "/:key",
    controller.setEnabled
  );

  return router;
}
