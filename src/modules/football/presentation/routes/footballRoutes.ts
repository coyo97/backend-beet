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

    router.get(
    "/teams/:teamName/late-goal-profile",
    controller
      .getLateGoalProfile
  );

  router.get(
  "/late-goal-comparison",
  controller
    .getLateGoalComparisonProfile
);

router.post(
  "/teams/late-goal-profiles",
  controller
    .getLateGoalProfiles
);

  return router;
}
