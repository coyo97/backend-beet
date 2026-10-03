import {
  FotMobClient,
} from "./FotMobClient";

import type {
  FotMobLeagueMatches,
  FotMobMatch,
} from "./FotMobTypes";

export interface FotMobFixtureCandidate {
  match:
    FotMobMatch;

  league:
    FotMobLeagueMatches;
}

export class FotMobFixtureCatalog {
  private items:
    FotMobFixtureCandidate[] =
      [];

  private loadedAt =
    0;

  private loading:
    Promise<
      FotMobFixtureCandidate[]
    > | null =
      null;

  constructor(
    private readonly client:
      FotMobClient,

    private readonly ttlMs =
      30_000
  ) {}

  public async getAll(
    force =
      false
  ): Promise<
    FotMobFixtureCandidate[]
  > {

    const fresh =
      !force &&
      this.loadedAt >
        0 &&
      Date.now() -
        this.loadedAt <
        this.ttlMs;

    if (fresh) {
      return this.items;
    }

    /*
     * Si 20 partidos intentan resolver
     * al mismo tiempo, todos reutilizan
     * esta misma carga.
     */
    if (this.loading) {
      return this.loading;
    }

    this.loading =
      this.load();

    try {
      const result =
        await this.loading;

      this.items =
        result;

      this.loadedAt =
        Date.now();

      return this.items;
    } catch (
      error
    ) {

      /*
       * Fail-soft:
       *
       * si FotMob falla temporalmente
       * pero teníamos catálogo anterior,
       * mantenemos el último.
       */
      if (
        this.items.length >
        0
      ) {
        return this.items;
      }

      throw error;
    } finally {
      this.loading =
        null;
    }
  }

  private async load():
    Promise<
      FotMobFixtureCandidate[]
    > {

    const dates =
      this.getDates();

    const responses =
      await Promise.allSettled(
        dates.map(
          (
            date
          ) =>
            this.client
              .getMatchesByDate(
                date
              )
        )
      );

    const items:
      FotMobFixtureCandidate[] =
        [];

    const seen =
      new Set<
        string
      >();

    for (
      const response
      of responses
    ) {

      if (
        response.status !==
        "fulfilled"
      ) {
        continue;
      }

      for (
        const league
        of response.value
          .leagues ??
          []
      ) {

        for (
          const match
          of league.matches ??
          []
        ) {

          const id =
            String(
              match.id
            );

          if (
            seen.has(
              id
            )
          ) {
            continue;
          }

          seen.add(
            id
          );

          items.push({
            match,
            league,
          });
        }
      }
    }

    return items;
  }

  private getDates():
    string[] {

    const now =
      new Date();

    return [
      -1,
      0,
      1,
    ].map(
      (
        offset
      ) => {

        const date =
          new Date(
            now
          );

        date.setUTCDate(
          date.getUTCDate() +
          offset
        );

        return [
          date.getUTCFullYear(),

          String(
            date.getUTCMonth() +
              1
          ).padStart(
            2,
            "0"
          ),

          String(
            date.getUTCDate()
          ).padStart(
            2,
            "0"
          ),
        ].join(
          ""
        );
      }
    );
  }
}
