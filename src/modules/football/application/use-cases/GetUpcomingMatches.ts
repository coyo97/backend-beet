
import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  UpcomingMatchProvider,
} from "../../domain/providers/UpcomingMatchProvider";

export interface UpcomingMatchFilters {
  hours?: number;
  limit?: number;
}

export class GetUpcomingMatches {

  constructor(
    private readonly provider:
      UpcomingMatchProvider
  ) {}

  public async execute(
    filters: UpcomingMatchFilters = {}
  ): Promise<LiveMatch[]> {

    const now = Date.now();

    const hours =
      Math.min(
        Math.max(
          filters.hours ?? 48,
          1
        ),
        168
      );

    const limit =
      Math.min(
        Math.max(
          filters.limit ?? 1000,
          1
        ),
        5000
      );

    const until =
      now + hours * 60 * 60 * 1000;

    const matches =
      await this.provider
        .getUpcomingMatches();

    return matches
      .filter(match => {

        const kickoff =
          Date.parse(
            match.kickoffAt
          );

        return (
          Number.isFinite(kickoff) &&
          kickoff > now &&
          kickoff <= until &&
          match.status.short === "NS"
        );
      })
      .sort(
        (a, b) =>
          Date.parse(a.kickoffAt) -
          Date.parse(b.kickoffAt)
      )
      .slice(0, limit);
  }
}

