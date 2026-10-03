import type {
  FootballProvider,
} from "../../../domain/providers/FootballProvider";

import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import {
  FotMobClient,
} from "./FotMobClient";

import type {
  FotMobLeagueMatches,
  FotMobMatch,
} from "./FotMobTypes";

export class FotMobProvider
  implements FootballProvider
{
  constructor(
    private readonly client:
      FotMobClient
  ) {}

  public async getLiveMatches():
    Promise<LiveMatch[]> {

    /*
     * Consultamos ayer/hoy/mañana.
     *
     * Así evitamos perder partidos
     * alrededor de medianoche UTC.
     */
    const dates =
      this.getRelevantDates();

    const results =
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

    const matches =
      new Map<
        string,
        LiveMatch
      >();

    for (
      const result
      of results
    ) {
      if (
        result.status !==
        "fulfilled"
      ) {
        continue;
      }

      for (
        const league
        of result.value
          .leagues ??
          []
      ) {
        for (
          const match
          of league.matches ??
          []
        ) {
          if (
            !this.isLive(
              match
            )
          ) {
            continue;
          }

          matches.set(
            String(
              match.id
            ),
            this.toLiveMatch(
              match,
              league
            )
          );
        }
      }
    }

    return Array.from(
      matches.values()
    );
  }

  private isLive(
    match:
      FotMobMatch
  ): boolean {

    return (
      match.status
        ?.started ===
        true &&
      match.status
        ?.finished !==
        true &&
      match.status
        ?.cancelled !==
        true
    );
  }

  private toLiveMatch(
    match:
      FotMobMatch,

    league:
      FotMobLeagueMatches
  ): LiveMatch {

    const homeScore =
      typeof match.home
        ?.score ===
        "number"
        ? match.home.score
        : null;

    const awayScore =
      typeof match.away
        ?.score ===
        "number"
        ? match.away.score
        : null;

    return {
      sources: [
        {
          provider:
            "fotmob",

          externalId:
            String(
              match.id
            ),
        },
      ],

      kickoffAt:
        match.status
          ?.utcTime ??
        new Date()
          .toISOString(),

      status: {
        long:
          this.statusText(
            match
          ),

        short:
          "LIVE",

        minute:
          this.extractMinute(
            match
          ),
      },

      competition: {
        id:
          String(
            match.leagueId ??
            league.id ??
            league.primaryId ??
            ""
          ) ||
          null,

        name:
          league.name,

        country:
          league.ccode ??
          "Unknown",

        logo:
          null,

        flag:
          null,

        season:
          null,

        round:
          null,
      },

      home: {
        id:
          match.home
            ?.id !==
          undefined
            ? String(
                match.home.id
              )
            : null,

        name:
          match.home
            ?.name ??
          match.home
            ?.longName ??
          "Home",

        logo:
          null,

        goals:
          homeScore,

        winner:
          this.resolveWinner(
            homeScore,
            awayScore,
            "home"
          ),
      },

      away: {
        id:
          match.away
            ?.id !==
          undefined
            ? String(
                match.away.id
              )
            : null,

        name:
          match.away
            ?.name ??
          match.away
            ?.longName ??
          "Away",

        logo:
          null,

        goals:
          awayScore,

        winner:
          this.resolveWinner(
            homeScore,
            awayScore,
            "away"
          ),
      },

      dataAvailability: {
        score:
          homeScore !==
            null &&
          awayScore !==
            null,

        /*
         * Sabemos que FotMob puede tenerlos,
         * pero la lista diaria no garantiza
         * cobertura detallada para cada partido.
         */
        events:
          false,

        redCards:
          false,

        statistics:
          false,

        possession:
          false,

        shots:
          false,

        corners:
          false,

        lineups:
          false,

        odds:
          false,
      },
    };
  }

  private statusText(
    match:
      FotMobMatch
  ): string {

    const reason =
      match.status
        ?.reason;

    if (
      typeof reason ===
      "string"
    ) {
      return reason;
    }

    if (
      reason &&
      typeof reason ===
        "object"
    ) {
      return (
        reason.long ??
        reason.short ??
        "Live"
      );
    }

    return "Live";
  }

  private extractMinute(
    match:
      FotMobMatch
  ): number | null {

    const reason =
      this.statusText(
        match
      );

    const matchResult =
      reason.match(
        /(\d{1,3})/
      );

    if (!matchResult) {
      return null;
    }

    const minute =
      Number(
        matchResult[1]
      );

    if (
      !Number.isFinite(
        minute
      ) ||
      minute >
        150
    ) {
      return null;
    }

    return minute;
  }

  private resolveWinner(
    home:
      number | null,

    away:
      number | null,

    side:
      "home" |
      "away"
  ): boolean | null {

    if (
      home ===
        null ||
      away ===
        null ||
      home ===
        away
    ) {
      return null;
    }

    return side ===
      "home"
      ? home >
        away
      : away >
        home;
  }

  private getRelevantDates():
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
