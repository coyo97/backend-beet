import type {
  CreateTeamMemoryEventInput,
  TeamMemoryEvent,
  TeamMemorySummary,
} from "../entities/TeamMemory";

export interface TeamMemoryRepository {
  create(
    input:
      CreateTeamMemoryEventInput
  ): Promise<
    TeamMemoryEvent
  >;

  summaries(
    teamNames:
      string[]
  ): Promise<
    TeamMemorySummary[]
  >;

  findByTeam(
    teamName:
      string,

    limit?:
      number
  ): Promise<
    TeamMemoryEvent[]
  >;

  deleteById(
    id:
      string
  ): Promise<
    TeamMemoryEvent |
    null
  >;
}
