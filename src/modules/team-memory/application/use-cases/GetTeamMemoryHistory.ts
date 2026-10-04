import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

export class GetTeamMemoryHistory {
  constructor(
    private readonly repository:
      TeamMemoryRepository
  ) {}

public execute(
  ownerId:
    string,

  teamName:
    string,

  limit =
    20
) {

    const normalizedLimit =
      Math.min(
        Math.max(
          limit,
          1
        ),
        100
      );

return this.repository
  .findByTeam(
    ownerId,
    teamName,
    normalizedLimit
  );
  }
}
