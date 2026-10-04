import {
  Router,
} from "express";

import type {
  FootballController,
} from "../controllers/FootballController";

export function createFootballRouter(
  controller:
    FootballController
): Router {

  const router =
    Router();

  router.get(
    "/live",
    controller.getLive
  );

  router.get(
    "/recent",
    controller.getRecent
  );

  router.get(
    "/matches/:id/statistics",
    controller.getStatistics
  );

  return router;
}
