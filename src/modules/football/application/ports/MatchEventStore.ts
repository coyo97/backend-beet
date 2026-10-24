import type {
  MatchEventSnapshot,
} from "../../domain/entities/MatchEventSnapshot";

export interface MatchEventStore {

  upsert(
    snapshot:
      MatchEventSnapshot
  ): Promise<void>;

  findByTeam(
    teamName:
      string,

    limit?:
      number
  ): Promise<
    MatchEventSnapshot[]
  >;

  findByTeams(
    teamNames:
      string[],

    limitPerTeam?:
      number
  ): Promise<
    MatchEventSnapshot[]
  >;
}
