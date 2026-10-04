import {
  Router,
} from "express";

import {
  env,
} from "../../../config/env";

import {
  radarRouter,
} from "../../../modules/radar/radarModule";

import {
  teamMemoryRouter,
} from "../../../modules/team-memory/teamMemoryModule";

import {
  teamPersonalProfileRouter,
} from "../../../modules/team-profile/teamPersonalProfileModule";

import {
  opportunityFilterRouter,
} from "../../../modules/opportunity-filter/opportunityFilterModule";

import {
  radarReviewRouter,
} from "../../../modules/radar-review/radarReviewModule";

import {
  footballRouter,
} from "../../../modules/football/footballModule";

import {
  notificationRouter,
} from "../../../modules/notifications/notificationModule";

import {
  matchContextRouter,
} from "../../../modules/match-context/matchContextModule";

import {
  watchlistRouter,
} from "../../../modules/watchlist/watchlistModule";

export function createApiRouter():
  Router {

  const router =
    Router();

  router.get(
    "/health",
    (
      _req,
      res
    ) => {

      res.json({
        ok:
          true,

        service:
          "football-radar-api",

        environment:
          env.NODE_ENV,

        timestamp:
          new Date()
            .toISOString(),
      });
    }
  );

  router.use(
    "/football",
    footballRouter
  );

  router.use(
    "/football",
    matchContextRouter
  );

  router.use(
    "/radar",
    radarRouter
  );

  router.use(
    "/radar",
    radarReviewRouter
  );

  router.use(
    "/watchlist",
    watchlistRouter
  );

  router.use(
    "/notifications",
    notificationRouter
  );

  router.use(
    "/team-memory",
    teamMemoryRouter
  );

  router.use(
    "/team-profiles",
    teamPersonalProfileRouter
  );

  router.use(
  "/opportunities",
  opportunityFilterRouter
);

  return router;
}
