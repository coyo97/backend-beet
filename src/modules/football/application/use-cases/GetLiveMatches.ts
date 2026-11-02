import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  FootballProvider,
} from "../../domain/providers/FootballProvider";

import type {
  RecentMatchStore,
} from "../ports/RecentMatchStore";

import {
  liveMatchesSnapshotStore,
} from "../services/LiveMatchesSnapshotStore";

export interface LiveMatchFilters {
  country?:
    string;
}

export class GetLiveMatches {
  constructor(
    private readonly provider:
      FootballProvider,

    private readonly recentMatchStore?:
      RecentMatchStore
  ) {}

  public async execute(
    filters:
      LiveMatchFilters = {}
  ): Promise<
    LiveMatch[]
  > {

    const matches =
      await this.provider
        .getLiveMatches();


		/*
 * Compartir el resultado ya
 * consultado con otros módulos.
 *
 * No hace una nueva solicitud
 * a Flashscore ni FotMob.
 */
liveMatchesSnapshotStore.observe(
  matches
);
    /*
     * Persistir recientes nunca debe
     * romper el endpoint live.
     *
     * Por eso es fail-soft y no bloquea
     * el resultado principal.
     */
    if (
      this.recentMatchStore
    ) {
      void this
        .recentMatchStore
        .observe(
          matches
        )
        .catch(
          (
            error
          ) => {
            console.error(
              "[GetLiveMatches.recent]",
              error
            );
          }
        );
    }

    if (
      !filters.country
    ) {
      return matches;
    }

    const country =
      this.normalize(
        filters.country
      );

    return matches.filter(
      (
        match
      ) =>
        this.normalize(
          match.competition
            .country
        ) ===
        country
    );
  }

  private normalize(
    value:
      string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim()
      .toLowerCase();
  }
}
