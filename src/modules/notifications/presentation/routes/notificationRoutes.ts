
import {
  Router,
} from "express";

import type {
  NotificationController,
} from "../controllers/NotificationController";

import {
  UpcomingPushPreferencesController,
} from "../controllers/UpcomingPushPreferencesController";

import {
  TeamMemoryLiveVolumeController,
} from "../controllers/TeamMemoryLiveVolumeController";

import {
  TeamMemoryPushPreferencesController,
} from "../controllers/TeamMemoryPushPreferencesController";

import {
  UpcomingDailyLimitController,
} from "../controllers/UpcomingDailyLimitController";

export function createNotificationRouter(
  controller: NotificationController
): Router {

  const router = Router();

  const upcomingPreferences =
    new UpcomingPushPreferencesController();

  const teamMemoryPreferences =
  new TeamMemoryPushPreferencesController();

  const upcomingDailyLimit =
  new UpcomingDailyLimitController();

  const teamMemoryVolume =
  new TeamMemoryLiveVolumeController();

  /*
   * Registro autenticado
   * de dispositivos.
   */
  router.post(
    "/devices",
    controller.registerDevice
  );

  router.post(
    "/devices/unregister",
    controller.unregisterDevice
  );

  /*
   * Push existente.
   */
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

  /*
   * NUEVO:
   * Consentimiento específico
   * para próximos partidos.
   */
  router.get(
    "/upcoming-preferences",
    upcomingPreferences.list
  );

  router.patch(
    "/upcoming-preferences",
    upcomingPreferences.update
  );

  /*
 * Preferencias de Team Memory.
 *
 * Independientes de:
 * - Alertas globales
 * - Próximos partidos
 * - Watchlist
 */
router.get(
  "/team-memory-preferences",
  teamMemoryPreferences.list
);

router.patch(
  "/team-memory-preferences",
  teamMemoryPreferences.update
);

/*
 * Límite diario de próximos partidos.
 * Propietario obtenido del JWT.
 */
router.get(
  "/upcoming-daily-limit",
  upcomingDailyLimit.get
);

router.patch(
  "/upcoming-daily-limit",
  upcomingDailyLimit.update
);

router.get(
  "/team-memory-volume",
  teamMemoryVolume.get
);

router.patch(
  "/team-memory-volume",
  teamMemoryVolume.update
);

  return router;
}

