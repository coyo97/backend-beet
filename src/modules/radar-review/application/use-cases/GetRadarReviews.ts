import type {
  RadarReviewRepository,
} from "../../domain/repositories/RadarReviewRepository";

export class GetRadarReviews {
  constructor(
    private readonly repository:
      RadarReviewRepository
  ) {}

  public execute() {
    return this.repository
      .findAll();
  }
}
