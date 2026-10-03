import {
  Router,
} from "express";

import type {
  RadarController,
} from "../controllers/RadarController";

import type {
  UnifiedRedCardsController,
} from "../../infrastructure/http/UnifiedRedCardsController";

import type {
  RedCardDetectedController,
} from "../../infrastructure/http/RedCardDetectedController";

import type {
  SupplementalRedCardsController,
} from "../../infrastructure/http/SupplementalRedCardsController";

export function createRadarRouter(
  controller:
    RadarController,

  supplementalRedCardsController:
    SupplementalRedCardsController,

  unifiedRedCardsController:
    UnifiedRedCardsController,

  redCardDetectedController:
    RedCardDetectedController
): Router {
	
  const router =
    Router();

  /*
   * Radar original.
   *
   * NO modificar.
   */
  router.get(
    "/red-cards",
    controller.getRedCards
  );

  /*
   * Nuevo radar suplementario.
   *
   * 1xBet + FotMob.
   */
  router.get(
    "/red-cards/supplemental",
    supplementalRedCardsController.list
  );

  router.get(
    "/red-card-pressure",
    controller.getRedCardPressure
  );

  router.get(
    "/matches/:id/pressure",
    controller.getPressure
  );

  router.get(
    "/signals/recent",
    controller.getRecentSignals
  );
  router.get(
  "/red-cards/v2",
  unifiedRedCardsController.list
);

router.get(
  "/red-card-detections",
  redCardDetectedController.list
);

  return router;
}
