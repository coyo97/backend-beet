import type {
  RecentMatchStore,
} from "../ports/RecentMatchStore";

export interface GetRecentMatchesInput {
  hours?:
    number;

  limit?:
    number;
}

export class GetRecentMatches {
  constructor(
    private readonly store:
      RecentMatchStore
  ) {}

  public execute(
    input:
      GetRecentMatchesInput = {}
  ) {

    const hours =
      Math.min(
        Math.max(
          Number.isFinite(
            input.hours
          )
            ? Number(
                input.hours
              )
            : 48,
          1
        ),
        168
      );

    const limit =
      Math.min(
        Math.max(
          Number.isFinite(
            input.limit
          )
            ? Number(
                input.limit
              )
            : 50,
          1
        ),
        400
      );

    const since =
      new Date(
        Date.now() -
        hours *
        60 *
        60 *
        1000
      );

    return this.store
      .listRecent({
        since,
        limit,
      });
  }
}
