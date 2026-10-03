import {
  Router,
} from "express";

import type {
  TeamMemoryController,
} from "../controllers/TeamMemoryController";

export function createTeamMemoryRouter(
  controller:
    TeamMemoryController
): Router {

  const router =
    Router();

  router.post(
    "/summaries",
    controller.summaries
  );

  router.get(
    "/events",
    controller.history
  );

  router.post(
    "/events",
    controller.createEvent
  );

  router.delete(
    "/events/:id",
    controller.deleteEvent
  );

  return router;
}
