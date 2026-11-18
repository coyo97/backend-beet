import {
  flashscoreUpcomingShared,
} from "../football/infrastructure/providers/flashscore/flashscoreUpcomingShared";

import {
  GetUpcomingMatches,
} from "../football/application/use-cases/GetUpcomingMatches";

import {
  UpcomingLeagueCandidateScanner,
} from "./application/services/UpcomingLeagueCandidateScanner";

import {
  UpcomingOpportunityReviewQueue,
} from "./application/services/UpcomingOpportunityReviewQueue";

import {
  MongooseUpcomingOpportunityRepository,
} from "./infrastructure/repositories/MongooseUpcomingOpportunityRepository";

import {
  UpcomingOpportunityScheduler,
} from "./infrastructure/schedulers/UpcomingOpportunityScheduler";

import {
  getLiveOpportunities,
} from "./opportunityFilterModule";

export function createUpcomingOpportunityScheduler():
  UpcomingOpportunityScheduler {

  /*
   * CAMBIO:
   * Reutilizamos el proveedor
   * compartido de Flashscore.
   *
   * Antes se creaba una nueva
   * instancia en este método.
   */
  const upcoming =
    new GetUpcomingMatches(
      flashscoreUpcomingShared
    );

  /*
   * EXISTENTE:
   * Conservamos el scanner
   * y su comportamiento.
   */
  const scanner =
    new UpcomingLeagueCandidateScanner(
      upcoming
    );

  /*
   * EXISTENTE:
   * Misma instancia que utiliza
   * el módulo de oportunidades Live.
   */
  const queue =
    new UpcomingOpportunityReviewQueue(
      getLiveOpportunities
    );

  const repository =
    new MongooseUpcomingOpportunityRepository();

  return new UpcomingOpportunityScheduler(
    scanner,
    queue,
    repository
  );
}
