import type {
  LiveMatch,
} from "../../domain/entities/LiveMatch";

import type {
  ApiFootballFixture,
} from "../providers/api-football/ApiFootballTypes";

export class ApiFootballLiveMatchMapper {
  public static toDomain(
    data: ApiFootballFixture
  ): LiveMatch {
    return {
sources: [
  {
    provider: "api-football",
    externalId: String(data.fixture.id),
  },
],

      kickoffAt:
        data.fixture.date,

      status: {
        long:
          data.fixture.status.long,

        short:
          data.fixture.status.short,

        minute:
          data.fixture.status.elapsed,
      },

      competition: {
        id:
          String(
            data.league.id
          ),

        name:
          data.league.name,

        country:
          data.league.country,

        logo:
          data.league.logo ?? null,

        flag:
          data.league.flag ?? null,

        season:
          data.league.season != null
            ? String(
                data.league.season
              )
            : null,

        round:
          data.league.round ?? null,
      },

      home: {
        id:
          String(
            data.teams.home.id
          ),

        name:
          data.teams.home.name,

        logo:
          data.teams.home.logo ?? null,

        goals:
          data.goals.home,

        winner:
          data.teams.home.winner,
      },

      away: {
        id:
          String(
            data.teams.away.id
          ),

        name:
          data.teams.away.name,

        logo:
          data.teams.away.logo ?? null,

        goals:
          data.goals.away,

        winner:
          data.teams.away.winner,
      },

      dataAvailability: {
        score: true,

        // /fixtures?live=all por sí solo
        // no significa que ya tengamos
        // cargados estos datos.
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
}
