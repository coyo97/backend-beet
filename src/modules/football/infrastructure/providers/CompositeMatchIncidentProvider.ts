import type {
  MatchSource,
} from "../../domain/entities/LiveMatch";

import type {
  MatchIncident,
} from "../../domain/entities/MatchIncident";

import type {
  MatchIncidentProvider,
} from "../../domain/providers/MatchIncidentProvider";

export class CompositeMatchIncidentProvider
  implements MatchIncidentProvider
{
  constructor(
    private readonly providers:
      MatchIncidentProvider[]
  ) {}

  public supports(
    source:
      MatchSource
  ): boolean {

    return this.providers
      .some(
        provider =>
          provider.supports(
            source
          )
      );
  }

  public async getIncidents(
    source:
      MatchSource
  ): Promise<
    MatchIncident[]
  > {

    const provider =
      this.providers
        .find(
          candidate =>
            candidate.supports(
              source
            )
        );

    if (!provider) {
      return [];
    }

    return provider
      .getIncidents(
        source
      );
  }
}
