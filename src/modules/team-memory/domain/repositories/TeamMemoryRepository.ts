import type {
  CreateTeamMemoryEventInput,
  TeamMemoryEvent,
  TeamMemorySummary,
} from "../entities/TeamMemory";

export interface TeamMemoryRepository {
  create(
    ownerId:
      string,

    input:
      CreateTeamMemoryEventInput
  ): Promise<
    TeamMemoryEvent
  >;

  summaries(
    ownerId:
      string,

    teamNames:
      string[]
  ): Promise<
    TeamMemorySummary[]
  >;

  findByTeam(
    ownerId:
      string,

    teamName:
      string,

    limit?:
      number
  ): Promise<
    TeamMemoryEvent[]
  >;

  deleteById(
    ownerId:
      string,

    id:
      string
  ): Promise<
    TeamMemoryEvent |
    null
  >;
  allSummaries(
  ownerId:
    string
): Promise<
  TeamMemorySummary[]
>;
}
