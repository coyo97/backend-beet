export type RadarReviewStatus =
  | "marked"
  | "reviewed"
  | "dismissed";

export interface RadarReview {
  id:
    string;

  provider:
    string;

  externalId:
    string;

  status:
    RadarReviewStatus;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface SetRadarReviewInput {
  provider:
    string;

  externalId:
    string;

  status:
    RadarReviewStatus;
}
