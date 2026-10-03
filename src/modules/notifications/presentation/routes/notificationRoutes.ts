import {
  Router,
} from "express";

import type {
  NotificationController,
} from "../controllers/NotificationController";

export function createNotificationRouter(
  controller:
    NotificationController
): Router {

  const router =
    Router();

  router.post(
    "/devices",
    controller.registerDevice
  );

  router.post(
  "/test",
  controller.testPush
);

router.get(
  "/preferences",
  controller.getPreferences
);

router.patch(
  "/preferences",
  controller.updatePreferences
);
  return router;
}
