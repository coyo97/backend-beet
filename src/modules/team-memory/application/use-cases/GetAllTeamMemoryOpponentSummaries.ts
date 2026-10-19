import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

export class GetAllTeamMemoryOpponentSummaries {

  constructor(
    private readonly repository:
      TeamMemoryRepository
  ) {}

  public execute(
    ownerId:
      string
  ) {

    return this.repository
      .allOpponentSummaries(
        ownerId
      );
  }
}
