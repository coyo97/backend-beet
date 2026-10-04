import type {
  TeamPersonalProfileRepository,
} from "../../domain/repositories/TeamPersonalProfileRepository";

export class GetTeamPersonalProfile {
  constructor(
    private readonly repository:
      TeamPersonalProfileRepository
  ) {}

  public execute(
    ownerId:
      string,

    teamName:
      string
  ) {

    const normalized =
      teamName.trim();

    if (
      !normalized
    ) {
      throw new Error(
        "team is required"
      );
    }

    return this.repository
      .findByTeam(
        ownerId,
        normalized
      );
  }
}
