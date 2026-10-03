import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

export class DeleteTeamMemoryEvent {
  constructor(
    private readonly repository:
      TeamMemoryRepository
  ) {}

  public async execute(
    id:
      string
  ) {

    const deleted =
      await this.repository
        .deleteById(
          id
        );

    if (!deleted) {
      return null;
    }

    const [
      summary,
    ] =
      await this.repository
        .summaries([
          deleted.teamName,
        ]);

    return {
      deleted,
      summary,
    };
  }
}
