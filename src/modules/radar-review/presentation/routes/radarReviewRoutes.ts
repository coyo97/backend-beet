import {
  Router,
} from "express";

import type {
  RadarReviewController,
} from "../controllers/RadarReviewController";

export function createRadarReviewRouter(
  controller:
    RadarReviewController
): Router {

  const router =
    Router();

  router.get(
    "/reviews",
    controller.list
  );

  router.put(
    "/reviews/:provider/:externalId",
    controller.set
  );

  router.delete(
    "/reviews/:provider/:externalId",
    controller.reset
  );

  return router;
}
