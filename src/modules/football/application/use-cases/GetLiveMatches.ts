import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../domain/providers/FootballProvider";

export interface LiveMatchFilters {
  country?: string;
}

export class GetLiveMatches {
  constructor(
    private readonly provider:
      FootballProvider
  ) {}

  public async execute(
    filters: LiveMatchFilters = {}
  ): Promise<LiveMatch[]> {

    const matches =
      await this.provider
        .getLiveMatches();

    if (!filters.country) {
      return matches;
    }

    const country =
      this.normalize(
        filters.country
      );

    return matches.filter(
      (match) =>
        this.normalize(
          match.competition.country
        ) === country
    );
  }

  private normalize(
    value: string
  ): string {

    return value
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase();
  }
}
