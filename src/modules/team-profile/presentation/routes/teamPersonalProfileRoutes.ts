import {
  Router,
} from "express";

import type {
  TeamPersonalProfileController,
} from "../controllers/TeamPersonalProfileController";

export function createTeamPersonalProfileRouter(
  controller:
    TeamPersonalProfileController
): Router {

  const router =
    Router();

  router.get(
    "/",
    controller.list
  );

  router.get(
    "/by-team",
    controller.get
  );

  router.put(
    "/",
    controller.save
  );

  return router;
}
