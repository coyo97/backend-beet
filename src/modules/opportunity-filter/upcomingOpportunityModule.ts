
import {
  FlashscoreUpcomingMatchesProvider,
} from "../football/infrastructure/providers/flashscore/FlashscoreUpcomingMatchesProvider";

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

  const provider =
    new FlashscoreUpcomingMatchesProvider();

  const upcoming =
    new GetUpcomingMatches(provider);

  const scanner =
    new UpcomingLeagueCandidateScanner(
      upcoming
    );

  /*
   * Misma instancia que utiliza
   * el módulo de oportunidades Live.
   *
   * Comparte el presupuesto
   * de contexto profundo.
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

