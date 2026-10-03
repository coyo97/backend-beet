import type {
  RadarReviewStatus,
} from "../../domain/entities/RadarReview";

import type {
  RadarReviewRepository,
} from "../../domain/repositories/RadarReviewRepository";

export class SetRadarReview {
  constructor(
    private readonly repository:
      RadarReviewRepository
  ) {}

  public execute(
    provider:
      string,

    externalId:
      string,

    status:
      RadarReviewStatus
  ) {

    return this.repository
      .upsert({
        provider,
        externalId,
        status,
      });
  }
}
