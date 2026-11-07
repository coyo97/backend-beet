
import {
  Router,
} from "express";

import type {
  AlertRulesController,
} from "../controllers/AlertRulesController";

export function createAlertRulesRouter(
  controller: AlertRulesController
): Router {

  const router = Router();

  router.get(
    "/",
    controller.list
  );

  router.post(
    "/",
    controller.create
  );

  router.put(
  "/:id",
  controller.replace
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

