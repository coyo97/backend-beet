
import {
  liveMatchesSnapshotStore,
} from "../football/application/services/LiveMatchesSnapshotStore";

import {
  FindTeamMemoryLiveAlerts,
} from "./application/services/FindTeamMemoryLiveAlerts";

import {
  isAutoPushTestOwnerAllowed,
} from "./application/services/AutoPushTestOwnerGate";

import {
  DispatchTeamMemoryLiveAlerts,
} from "./application/services/DispatchTeamMemoryLiveAlerts";

import {
  ClaimTeamMemoryLiveDelivery,
} from "./application/services/ClaimTeamMemoryLiveDelivery";

import {
  MongooseTeamMemoryLiveVolumeRepository,
} from "./infrastructure/repositories/MongooseTeamMemoryLiveVolumeRepository";

import {
  MongooseTeamMemoryLiveOptInRepository,
} from "./infrastructure/repositories/MongooseTeamMemoryLiveOptInRepository";

import {
  TeamMemoryLivePreviewScheduler,
} from "./infrastructure/schedulers/TeamMemoryLivePreviewScheduler";

import {
  pushDeviceRepository,
  pushPreferencesRepository,
  pushNotificationSender,
} from "./notificationModule";

/*
 * Detector de partidos que
 * coinciden con Team Memory.
 */
export const findTeamMemoryLiveAlerts =
  new FindTeamMemoryLiveAlerts();

/*
 * Consentimiento independiente
 * de Team Memory.
 */
export const teamMemoryLiveOptIns =
  new MongooseTeamMemoryLiveOptInRepository();

/*
 * Reservas persistentes.
 */
export const teamMemoryLiveClaims =
  new ClaimTeamMemoryLiveDelivery();

export const teamMemoryLiveVolumeRepository =
  new MongooseTeamMemoryLiveVolumeRepository();

/*
 * Limitador de pruebas.
 *
 * No reserva cupos para cuentas
 * distintas de la autorizada.
 */
export const teamMemoryTestVolumeLimiter = {
  async tryReserve(
    ownerId: string,
    matchKey: string
  ): Promise<boolean> {

    if (
      !isAutoPushTestOwnerAllowed(ownerId)
    ) {
      return false;
    }

    return teamMemoryLiveVolumeRepository
      .tryReserve(ownerId, matchKey);
  },
};

/*
 * Despachador personalizado.
 *
 * Último argumento: false.
 *
 * Mantiene bloqueadas todas
 * las llamadas reales a Expo.
 */
export const dispatchTeamMemoryLiveAlerts =
  new DispatchTeamMemoryLiveAlerts(
    pushDeviceRepository,
    pushPreferencesRepository,
    teamMemoryLiveOptIns,
    teamMemoryLiveClaims,
    pushNotificationSender,

    process.env.TEAM_MEMORY_LIVE_SEND_ENABLED ===
      "true",

	teamMemoryLiveVolumeRepository
  );

/*
 * Scheduler automático.
 *
 * Utiliza partidos que el
 * backend ya consultó.
 *
 * No genera peticiones extra
 * a los proveedores.
 */
export function createTeamMemoryLivePreviewScheduler():
  TeamMemoryLivePreviewScheduler {

  return new TeamMemoryLivePreviewScheduler(
    liveMatchesSnapshotStore,
    findTeamMemoryLiveAlerts,
    60_000,
    120_000,
    dispatchTeamMemoryLiveAlerts
  );
}

