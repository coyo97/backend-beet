import {
  FlashscoreUpcomingMatchesProvider,
} from "./FlashscoreUpcomingMatchesProvider";

/*
 * Instancia compartida para:
 *
 * - UpcomingOpportunityScheduler
 * - Starting Soon
 *
 * Conserva la caché y el control
 * de solicitudes concurrentes.
 */
export const flashscoreUpcomingShared =
  new FlashscoreUpcomingMatchesProvider();
