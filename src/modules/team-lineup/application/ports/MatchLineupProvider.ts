import type {
  MatchLineupSnapshot,
} from "../../domain/entities/MatchLineupSnapshot";

export interface MatchLineupProvider {
  supports(
    provider:
      string
  ): boolean;

  getLineup(
    provider:
      string,

    externalId:
      string
  ): Promise<
    MatchLineupSnapshot
  >;
}
