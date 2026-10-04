export type TeamPersonalLabel =
  | "avoid"
  | "watch"
  | "trusted";

export interface TeamPersonalProfile {
  id:
    string;

  teamName:
    string;

  teamKey:
    string;

  label:
    TeamPersonalLabel |
    null;

  note:
    string | null;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface SaveTeamPersonalProfileInput {
  teamName:
    string;

  label?:
    TeamPersonalLabel |
    null;

  note?:
    string |
    null;
}
