import type {
  MatchContext,
} from "../../domain/entities/MatchContext";

export interface MatchContextProvider {
  supports(
    provider:
      string
  ): boolean;

  getContext(
    externalId:
      string
  ): Promise<
    MatchContext
  >;
}
