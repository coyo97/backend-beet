import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

export class GetAllTeamMemorySummaries {
  constructor(
    private readonly repository:
      TeamMemoryRepository
  ) {}

  public execute(
    ownerId:
      string
  ) {

    return this.repository
      .allSummaries(
        ownerId
      );
  }
}
