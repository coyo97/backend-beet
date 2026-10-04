import type {
  SaveTeamPersonalProfileInput,
  TeamPersonalProfile,
} from "../entities/TeamPersonalProfile";

export interface TeamPersonalProfileRepository {
  save(
    ownerId:
      string,

    input:
      SaveTeamPersonalProfileInput
  ): Promise<
    TeamPersonalProfile
  >;

  findByTeam(
    ownerId:
      string,

    teamName:
      string
  ): Promise<
    TeamPersonalProfile |
    null
  >;

  list(
    ownerId:
      string
  ): Promise<
    TeamPersonalProfile[]
  >;

  deleteByTeam(
    ownerId:
      string,

    teamName:
      string
  ): Promise<boolean>;
}
