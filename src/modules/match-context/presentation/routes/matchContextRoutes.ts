import {
  Router,
} from "express";

import type {
  MatchContextController,
} from "../controllers/MatchContextController";

export function createMatchContextRouter(
  controller:
    MatchContextController
): Router {

  const router =
    Router();

  router.get(
    "/matches/:provider/:id/context",
    controller.get
  );

  return router;
}
