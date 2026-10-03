import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  FlashscoreCompetition,
  FlashscoreMatch,
} from "../providers/flashscore/FlashscoreTypes";

export class FlashscoreLiveMatchMapper {
  public static toDomain(
    match: FlashscoreMatch,
    parentCompetition?:
      FlashscoreCompetition
  ): LiveMatch {

    const competition =
      match.competition ??
      parentCompetition;

    return {
      sources: [
        {
          provider:
            "flashscore",

          externalId:
            String(match.id),
        },
      ],

      kickoffAt:
        match.start_time,

      status: {
        long:
          match.stage ??
          match.status,

        short:
          match.status,

        minute:
          this.extractMinute(
            match.stage
          ),
      },

      competition: {
        id: null,

        name:
          competition?.name ??
          "Unknown competition",

        country:
          competition
            ?.country
            ?.name ??
          "Unknown",

        logo: null,
        flag: null,
        season: null,

        round:
          match.round ??
          null,
      },

      home: {
        id:
          match.home.id ??
          null,

        name:
          match.home.name,

        logo:
          match.home.logo ??
          null,

        goals:
          match.home_score,

        winner:
          this.toWinner(
            match.winner,
            "home"
          ),
      },

      away: {
        id:
          match.away.id ??
          null,

        name:
          match.away.name,

        logo:
          match.away.logo ??
          null,

        goals:
          match.away_score,

        winner:
          this.toWinner(
            match.winner,
            "away"
          ),
      },

      dataAvailability: {
        score:
          match.home_score !== null ||
          match.away_score !== null,

        // Todavía no cargamos /summary
        // ni /statistics.
        events: false,
        redCards: false,
        statistics: false,
        possession: false,
        shots: false,
        corners: false,
        lineups: false,
        odds: false,
      },
    };
  }

  private static extractMinute(
    stage?: string | null
  ): number | null {

    if (!stage) {
      return null;
    }

    const result =
      stage.match(
        /(\d{1,3})/
      );

    if (!result) {
      return null;
    }

    const minute =
      Number(result[1]);

    return Number.isFinite(
      minute
    )
      ? minute
      : null;
  }

  private static toWinner(
    winner:
      | "home"
      | "away"
      | "draw"
      | null
      | undefined,

    side:
      | "home"
      | "away"
  ): boolean | null {

    if (
      !winner ||
      winner === "draw"
    ) {
      return null;
    }

    return winner === side;
  }
}
