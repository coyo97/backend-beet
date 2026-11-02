
import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import type {
  UpcomingMatchProvider,
} from "../../../domain/providers/UpcomingMatchProvider";

import {
  FlashscoreClient,
} from "./FlashscoreClient";

interface ScheduledTeam {
  id?: string | null;
  name?: string | null;
  logo?: string | null;
}

interface ScheduledMatch {
  id?: string | null;
  status?: string | null;
  start_time?: string | null;
  round?: string | null;
  home?: ScheduledTeam | null;
  away?: ScheduledTeam | null;
}

interface ScheduledCompetition {
  id?: string | null;
  name?: string | null;
  logo?: string | null;

  country?: {
    name?: string | null;
  } | null;
}

interface ScheduledGroup {
  competition?: ScheduledCompetition | null;
  matches?: ScheduledMatch[];
}

interface ScheduledFeed {
  competitions?: ScheduledGroup[];
}

export class FlashscoreUpcomingMatchesProvider
  implements UpcomingMatchProvider {

  private cached: LiveMatch[] = [];

  private expiresAt = 0;

  private inflight:
    Promise<LiveMatch[]> | null = null;

  constructor(
    private readonly client =
      new FlashscoreClient(),

    private readonly ttlMs =
      3 * 60 * 1000
  ) {}

  public async getUpcomingMatches():
    Promise<LiveMatch[]> {

    if (
      Date.now() < this.expiresAt
    ) {
      return [...this.cached];
    }

    if (this.inflight) {
      return this.inflight;
    }

    const pending = this.load();

    this.inflight = pending;

    try {
      const matches = await pending;

      this.cached = matches;

      this.expiresAt =
        Date.now() + this.ttlMs;

      return [...matches];
    } finally {
      this.inflight = null;
    }
  }

  private async load():
    Promise<LiveMatch[]> {

    /*
     * Reutiliza FlashscoreClient.
     *
     * No crea otro cliente HTTP.
     * No altera el proveedor Live.
     */
    const response =
      await this.client.get<ScheduledFeed>(
        "/matches",
        {
          sport: "football",
        }
      );

    const results: LiveMatch[] = [];

    const seen = new Set<string>();

    for (
      const group of
      response.competitions ?? []
    ) {
      const competition =
        group.competition;

      for (
        const item of
        group.matches ?? []
      ) {
        if (
          item.status !== "scheduled"
        ) {
          continue;
        }

        const id = item.id?.trim();

        const kickoff =
          item.start_time;

        const homeName =
          item.home?.name?.trim();

        const awayName =
          item.away?.name?.trim();

        if (
          !id ||
          !kickoff ||
          !homeName ||
          !awayName
        ) {
          continue;
        }

        const timestamp =
          Date.parse(kickoff);

        if (
          !Number.isFinite(timestamp) ||
          seen.has(id)
        ) {
          continue;
        }

        seen.add(id);

        results.push({
          sources: [
            {
              provider: "flashscore",
              externalId: id,
            },
          ],

          kickoffAt:
            new Date(
              timestamp
            ).toISOString(),

          status: {
            long: "Scheduled",
            short: "NS",
            minute: null,
          },

          competition: {
            id:
              competition?.id ?? null,

            name:
              competition?.name ??
              "Competición desconocida",

            country:
              competition?.country?.name ??
              "Desconocido",

            logo:
              competition?.logo ?? null,

            flag: null,
            season: null,

            round:
              item.round ?? null,
          },

          home: {
            id:
              item.home?.id ?? null,

            name: homeName,

            logo:
              item.home?.logo ?? null,

            goals: null,
            winner: null,
          },

          away: {
            id:
              item.away?.id ?? null,

            name: awayName,

            logo:
              item.away?.logo ?? null,

            goals: null,
            winner: null,
          },

          /*
           * Estos datos todavía no
           * corresponden a un
           * partido en desarrollo.
           */
          dataAvailability: {
            score: false,
            events: false,
            redCards: false,
            statistics: false,
            possession: false,
            shots: false,
            corners: false,
            lineups: false,
            odds: false,
          },
        });
      }
    }

    return results;
  }
}

