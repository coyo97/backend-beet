import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

export class GetTeamMemorySummaries {
  constructor(
    private readonly repository:
      TeamMemoryRepository
  ) {}

  public async execute(
    teams:
      string[]
  ) {

    const filtered =
      teams
        .map(
          (
            team
          ) =>
            team.trim()
        )
        .filter(
          Boolean
        )
        .slice(
          0,
          50
        );

    return this.repository
      .summaries(
        filtered
      );
  }
}
