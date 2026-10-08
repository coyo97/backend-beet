export type SharedMatchAction =
  | "share"
  | "leaning"
  | "bet";

export type SharedMatchSide =
  | "home"
  | "away";

export interface SharedMatchSource {
  provider:
    string;

  externalId:
    string;
}

export interface SharedMatchSnapshot {
  sources:
    SharedMatchSource[];

  kickoffAt:
    string;

  competitionName:
    string | null;

  country:
    string | null;

  homeName:
    string;

  awayName:
    string;

  homeGoals:
    number | null;

  awayGoals:
    number | null;

  minute:
    number | null;
}
