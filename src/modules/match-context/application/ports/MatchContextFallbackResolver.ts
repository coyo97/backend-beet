import type {
  MatchContext,
} from "../../domain/entities/MatchContext";

export interface MatchContextRequestMetadata {

	competitionId:
  string | null;

  competitionName:
    string;

  country:
    string | null;

  homeName:
    string;

  awayName:
    string;

}

export interface MatchContextFallbackInput
  extends
    MatchContextRequestMetadata {

  provider:
    string;

  externalId:
    string;
}

export interface MatchContextFallbackResolver {
  resolve(
    input:
      MatchContextFallbackInput
  ): Promise<
    MatchContext | null
  >;
}
