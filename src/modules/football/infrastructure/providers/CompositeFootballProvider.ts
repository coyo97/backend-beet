import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../domain/providers/FootballProvider";

import {
  LiveMatchDeduplicator,
} from "../../domain/services/LiveMatchDeduplicator";

interface ProviderEntry {
  name: string;

  provider:
    FootballProvider;
}

export class CompositeFootballProvider
  implements FootballProvider
{
  constructor(
    private readonly providers:
      ProviderEntry[],

    private readonly deduplicator:
      LiveMatchDeduplicator =
        new LiveMatchDeduplicator()
  ) {}

  public async getLiveMatches():
    Promise<LiveMatch[]> {

    const results =
      await Promise.allSettled(
        this.providers.map(
          async ({
            name,
            provider,
          }) => {
            const matches =
              await provider
                .getLiveMatches();

            return {
              name,
              matches,
            };
          }
        )
      );

    const matches:
      LiveMatch[] = [];

    for (
      const result
      of results
    ) {
      if (
        result.status ===
        "fulfilled"
      ) {
        matches.push(
          ...result
            .value
            .matches
        );

        continue;
      }

      console.error(
        "[CompositeFootballProvider]",
        result.reason
      );
    }

    return this
      .deduplicator
      .deduplicate(
        matches
      );
  }
}
