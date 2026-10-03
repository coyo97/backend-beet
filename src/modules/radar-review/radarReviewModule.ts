import {
  GetRadarReviews,
} from "./application/use-cases/GetRadarReviews";

import {
  SetRadarReview,
} from "./application/use-cases/SetRadarReview";

import {
  ResetRadarReview,
} from "./application/use-cases/ResetRadarReview";

import {
  MongooseRadarReviewRepository,
} from "./infrastructure/repositories/MongooseRadarReviewRepository";

import {
  RadarReviewController,
} from "./presentation/controllers/RadarReviewController";

import {
  createRadarReviewRouter,
} from "./presentation/routes/radarReviewRoutes";

export const radarReviewRepository =
  new MongooseRadarReviewRepository();

const getRadarReviews =
  new GetRadarReviews(
    radarReviewRepository
  );

const setRadarReview =
  new SetRadarReview(
    radarReviewRepository
  );

const resetRadarReview =
  new ResetRadarReview(
    radarReviewRepository
  );

const controller =
  new RadarReviewController(
    getRadarReviews,
    setRadarReview,
    resetRadarReview
  );

export const radarReviewRouter =
  createRadarReviewRouter(
    controller
  );
