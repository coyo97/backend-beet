import type {
  MatchSource,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MatchContext,
} from "../../domain/entities/MatchContext";

export interface MatchContextSourceProvider {
  supports(
    source:
      MatchSource
  ): boolean;

  getMatchContext(
    source:
      MatchSource
  ): Promise<
    MatchContext
  >;
}

export class CompositeMatchContextProvider {
  constructor(
    private readonly providers:
      MatchContextSourceProvider[]
  ) {}

  public supports(
    source:
      MatchSource
  ): boolean {

    return this.providers
      .some(
        (
          provider
        ) =>
          provider.supports(
            source
          )
      );
  }

  public async getMatchContext(
    source:
      MatchSource
  ): Promise<
    MatchContext
  > {

    const provider =
      this.providers.find(
        (
          candidate
        ) =>
          candidate.supports(
            source
          )
      );

    if (!provider) {
      throw new Error(
        `No MatchContext provider for ${source.provider}`
      );
    }

    return provider
      .getMatchContext(
        source
      );
  }
}
