import type {
  TeamPersonalProfileRepository,
} from "../../domain/repositories/TeamPersonalProfileRepository";

export class GetTeamPersonalProfiles {
  constructor(
    private readonly repository:
      TeamPersonalProfileRepository
  ) {}

  public execute(
    ownerId:
      string
  ) {

    return this.repository
      .list(
        ownerId
      );
  }
}
