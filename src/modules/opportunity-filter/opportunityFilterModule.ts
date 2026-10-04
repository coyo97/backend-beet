import {
  getLiveMatches,
} from "../football/footballModule";

import {
  getMatchContext,
} from "../match-context/matchContextModule";

import {
  MatchOpportunityScorer,
} from "./domain/services/MatchOpportunityScorer";

import {
  BettorFilter,
} from "./application/services/BettorFilter";

import {
  GetLiveOpportunities,
} from "./application/use-cases/GetLiveOpportunities";

import {
  OpportunityFilterController,
} from "./presentation/controllers/OpportunityFilterController";

import {
  createOpportunityFilterRouter,
} from "./presentation/routes/opportunityFilterRoutes";

const scorer =
  new MatchOpportunityScorer();

const filter =
  new BettorFilter();

export const getLiveOpportunities =
  new GetLiveOpportunities(
    getLiveMatches,
    getMatchContext,
    scorer,
    filter
  );

const controller =
  new OpportunityFilterController(
    getLiveOpportunities
  );

export const opportunityFilterRouter =
  createOpportunityFilterRouter(
    controller
  );
