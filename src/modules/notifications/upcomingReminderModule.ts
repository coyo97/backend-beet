
import {
  PlanUpcomingReminders,
} from "./application/services/PlanUpcomingReminders";

import {
  GetDueUpcomingReminders,
} from "./application/services/GetDueUpcomingReminders";

import {
  DispatchUpcomingReminders,
} from "./application/services/DispatchUpcomingReminders";

import {
  isAutoPushTestOwnerAllowed,
} from "./application/services/AutoPushTestOwnerGate";

import {
  MongooseUpcomingDailyLimitRepository,
} from "./infrastructure/repositories/MongooseUpcomingDailyLimitRepository";

import {
  ClaimUpcomingReminderDelivery,
} from "./application/services/ClaimUpcomingReminderDelivery";

import {
  MongooseUpcomingPushOptInRepository,
} from "./infrastructure/repositories/MongooseUpcomingPushOptInRepository";

import {
  MongooseUpcomingRecipientsReader,
} from "./infrastructure/repositories/MongooseUpcomingRecipientsReader";

import {
  UpcomingReminderScheduler,
} from "./infrastructure/schedulers/UpcomingReminderScheduler";

import {
  pushPreferencesRepository,
  pushNotificationSender,
} from "./notificationModule";

/*
 * ========================================
 * PLANIFICACIÓN
 * ========================================
 */

export const planUpcomingReminders =
  new PlanUpcomingReminders();

/*
 * ========================================
 * RECORDATORIOS PENDIENTES
 * ========================================
 */

export const getDueUpcomingReminders =
  new GetDueUpcomingReminders();

/*
 * ========================================
 * DEDUPLICACIÓN
 * ========================================
 */

export const upcomingDeliveryClaims =
  new ClaimUpcomingReminderDelivery();

/*
 * ========================================
 * CONSENTIMIENTOS INDIVIDUALES
 * ========================================
 */

export const upcomingPushOptIns =
  new MongooseUpcomingPushOptInRepository();

/*
 * ========================================
 * DESTINATARIOS MULTIUSUARIO
 * ========================================
 *
 * No requiere IDs en .env.
 *
 * Consulta automáticamente:
 * - usuarios propietarios
 * - dispositivos activos
 * - preferencias generales
 * - consentimiento Upcoming
 */

export const upcomingRecipientsReader =
  new MongooseUpcomingRecipientsReader(
    pushPreferencesRepository,
    upcomingPushOptIns
  );

/*
 * ========================================
 * DESPACHADOR
 * ========================================
 *
 * El envío real continúa desactivado
 * mientras verificamos la selección.
 */

export const upcomingDailyLimitRepository =
  new MongooseUpcomingDailyLimitRepository();

/*
 * Restringe las reservas diarias
 * de Upcoming a la cuenta de prueba.
 */
export const upcomingTestDailyLimit = {
  async tryReserve(
    ownerId: string,
    matchKey: string,
    window: "24h" | "60m"
  ): Promise<boolean> {

    if (
      !isAutoPushTestOwnerAllowed(ownerId)
    ) {
      return false;
    }

    return upcomingDailyLimitRepository
      .tryReserve(
        ownerId,
        matchKey,
        window
      );
  },
};

export const upcomingReminderDispatcher =
  new DispatchUpcomingReminders(
    getDueUpcomingReminders,
    upcomingRecipientsReader,
    upcomingDeliveryClaims,
    pushNotificationSender,
    process.env.UPCOMING_REMINDER_SEND_ENABLED === "true",
	upcomingDailyLimitRepository
  );

/*
 * ========================================
 * SCHEDULER
 * ========================================
 */

export function createUpcomingReminderScheduler():
  UpcomingReminderScheduler {

  return new UpcomingReminderScheduler(
    planUpcomingReminders,
    getDueUpcomingReminders,
    upcomingReminderDispatcher
  );
}

