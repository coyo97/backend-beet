import type {
  CreateTeamMemoryEventInput,
} from "../../domain/entities/TeamMemory";

import type {
  TeamMemoryRepository,
} from "../../domain/repositories/TeamMemoryRepository";

export class AddTeamMemoryEvent {
  constructor(
    private readonly repository:
      TeamMemoryRepository
  ) {}

public async execute(
  ownerId:
    string,

  input:
    CreateTeamMemoryEventInput
) {

    const teamName =
      input.teamName
        .trim();

    if (!teamName) {
      throw new Error(
        "teamName is required"
      );
    }

    if (
      input.outcome !==
        "win" &&
      input.outcome !==
        "loss"
    ) {
      throw new Error(
        "Invalid team memory outcome"
      );
    }

    const event =
      await this.repository
        .create(
  ownerId,
  {
          ...input,

          teamName,
        });

    const [
      summary,
    ] =
      await this.repository
        .summaries(
  ownerId,
  [
    teamName,
  ]
);

    return {
      event,
      summary,
    };
  }
}
