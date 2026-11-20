import type {
  FootballProvider,
} from "../../../domain/providers/FootballProvider";

import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import {
  OneXBetLiveClient,
} from "./OneXBetLiveClient";

import {
  OneXBetLiveHtmlParser,
} from "./OneXBetLiveHtmlParser";

import type {
  OneXBetLiveGame,
} from "./OneXBetLiveGame";

export class OneXBetLiveProvider
  implements FootballProvider
{
  constructor(
    private readonly client:
      OneXBetLiveClient,

    private readonly parser:
      OneXBetLiveHtmlParser
  ) {}

  public async getLiveMatches(
    country?:
      string
  ): Promise<
    LiveMatch[]
  > {

    const html =
      await this.client
        .getLiveHtml();

    const games =
      this.parser
        .parse(
          html
        );

    const normalizedCountry =
      country
        ?.trim()
        .toLowerCase();

    return games
      .filter(
        (
          game
        ) => {

          if (
            !normalizedCountry
          ) {
            return true;
          }

          return game
            .countryName
            .trim()
            .toLowerCase() ===
            normalizedCountry;
        }
      )
      .map(
        (
          game
        ) =>
          this.toLiveMatch(
            game
          )
      );
  }

  private toLiveMatch(
    game:
      OneXBetLiveGame
  ): LiveMatch {

    return {
      sources: [
        {
          provider:
            "bookmaker",

          externalId:
            game.id,
		  url: this.buildMatchUrl(game),
        },
      ],

      kickoffAt:
        game.startAt ??
        this.inferKickoffAt(
          game.clock
        ),

      status: {
        long:
          game.period ??
          "Live",

        short:
          "LIVE",

        minute:
          this.parseMinute(
            game.clock
          ),
      },

      competition: {
        id:
          game.championshipId,

        name:
          game.competitionName,

        country:
          game.countryName,

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
          game.homeId,

        name:
          game.homeName,

        logo:
          null,

        goals:
          game.homeScore,

        winner:
          this.winner(
            game.homeScore,
            game.awayScore,
            "home"
          ),
      },

      away: {
        id:
          game.awayId,

        name:
          game.awayName,

        logo:
          null,

        goals:
          game.awayScore,

        winner:
          this.winner(
            game.homeScore,
            game.awayScore,
            "away"
          ),
      },

      dataAvailability: {
        score:
          game.homeScore !==
            null &&
          game.awayScore !==
            null,

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

  private parseMinute(
    clock:
      string | null
  ): number | null {

    if (!clock) {
      return null;
    }

    /*
     * Ejemplos observados:
     *
     * 04:20
     * 16:57
     */
    const match =
      clock.match(
        /^(\d{1,3})(?::\d{1,2})?$/
      );

    if (!match) {
      return null;
    }

    const minute =
      Number(
        match[1]
      );

    if (
      !Number.isFinite(
        minute
      ) ||
      minute <
        0 ||
      minute >
        150
    ) {
      return null;
    }

    return minute;
  }

  private inferKickoffAt(
    clock:
      string | null
  ): string {

    if (!clock) {
      return new Date()
        .toISOString();
    }

    const match =
      clock.match(
        /^(\d{1,3}):(\d{1,2})$/
      );

    if (!match) {
      return new Date()
        .toISOString();
    }

    const minutes =
      Number(
        match[1]
      );

    const seconds =
      Number(
        match[2]
      );

    if (
      !Number.isFinite(
        minutes
      ) ||
      !Number.isFinite(
        seconds
      ) ||
      minutes >
        150
    ) {
      return new Date()
        .toISOString();
    }

    return new Date(
      Date.now() -
      (
        minutes *
          60 +
        seconds
      ) *
        1000
    ).toISOString();
  }

  private winner(
    home:
      number | null,

    away:
      number | null,

    target:
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

    return target ===
      "home"
      ? home >
        away
      : away >
        home;
  }

  private buildMatchUrl(
  game: OneXBetLiveGame
): string | undefined {

  const championship =
    game.champNameForUrl;

  const match =
    game.gameNameForUrl;

  if (!championship || !match) {
    return undefined;
  }

  // Evitar construir rutas con datos incorrectos.
  const validSlug = /^\d+-[a-z0-9-]+$/;

  if (
    !validSlug.test(championship) ||
    !validSlug.test(match)
  ) {
    return undefined;
  }

  if (
    !match.startsWith(`${game.id}-`)
  ) {
    return undefined;
  }

  if (
    game.championshipId &&
    !championship.startsWith(
      `${game.championshipId}-`
    )
  ) {
    return undefined;
  }

  try {
    const url = new URL(
      this.client.getLivePageUrl()
    );

    const basePath =
      url.pathname.match(
        /^(.*\/live\/football)(?:\/.*)?$/
      )?.[1];

    if (!basePath) {
      return undefined;
    }

    url.pathname =
      `${basePath}/${championship}/${match}`;

    url.search = "";
    url.hash = "";

    return url.toString();

  } catch {
    return undefined;
  }
}
}
