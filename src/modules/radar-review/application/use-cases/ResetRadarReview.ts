import type {
  RadarReviewRepository,
} from "../../domain/repositories/RadarReviewRepository";

export class ResetRadarReview {
  constructor(
    private readonly repository:
      RadarReviewRepository
  ) {}

  public execute(
    provider:
      string,

    externalId:
      string
  ) {

    return this.repository
      .delete(
        provider,
        externalId
      );
  }
}
