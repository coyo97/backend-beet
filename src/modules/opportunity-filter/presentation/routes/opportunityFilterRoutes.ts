import {
  Router,
} from "express";

import type {
  OpportunityFilterController,
} from "../controllers/OpportunityFilterController";

export function createOpportunityFilterRouter(
  controller:
    OpportunityFilterController
): Router {

  const router =
    Router();

  router.get(
    "/",
    controller.live
  );

  return router;
}
