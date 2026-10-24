import {
  Router,
} from "express";

import type {
  TeamLineupController,
} from "../controllers/TeamLineupController";

export function createTeamLineupRouter(
  controller:
    TeamLineupController
): Router {

  const router =
    Router();

  router.post(
    "/inspect",
    controller.inspect
  );

  return router;
}
