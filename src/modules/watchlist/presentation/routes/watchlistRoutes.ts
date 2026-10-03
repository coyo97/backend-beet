import {
  Router,
} from "express";

import type {
  WatchlistController,
} from "../controllers/WatchlistController";

export function createWatchlistRouter(
  controller:
    WatchlistController
): Router {

  const router =
    Router();

  router.get(
    "/",
    controller.list
  );

  router.post(
    "/",
    controller.create
  );

  router.patch(
    "/:id/enabled",
    controller.setEnabled
  );

  router.delete(
    "/:id",
    controller.remove
  );

  return router;
}
