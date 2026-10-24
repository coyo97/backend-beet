import type {
  MatchLineupSnapshot,
} from "../../domain/entities/MatchLineupSnapshot";

export interface FindRecentTeamLineupsInput {
  provider:
    string;

  teamId:
    string;

  limit?:
    number;

  excludeSourceKey?:
    string;
}

export interface MatchLineupStore {
  findBySourceKey(
    sourceKey:
      string
  ): Promise<
    MatchLineupSnapshot |
    null
  >;

  upsert(
    snapshot:
      MatchLineupSnapshot
  ): Promise<
    MatchLineupSnapshot
  >;

  findRecentConfirmedByTeam(
    input:
      FindRecentTeamLineupsInput
  ): Promise<
    MatchLineupSnapshot[]
  >;
}
