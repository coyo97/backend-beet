import type {
  RadarReview,
  SetRadarReviewInput,
} from "../entities/RadarReview";

export interface RadarReviewRepository {
  findAll():
    Promise<
      RadarReview[]
    >;

  upsert(
    input:
      SetRadarReviewInput
  ): Promise<
    RadarReview
  >;

  delete(
    provider:
      string,

    externalId:
      string
  ): Promise<void>;
}
