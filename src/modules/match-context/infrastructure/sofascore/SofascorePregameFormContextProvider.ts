import type {
  MatchContextProvider,
} from "../../application/ports/MatchContextProvider";

import type {
  CompetitionFormat,
  MatchContext,
  RecentResult,
  RecentTeamMatch,
  TeamMatchContext,
} from "../../domain/entities/MatchContext";

import {
  SofascoreSessionClient,
  type SofascoreApiLiveEvent,
  type SofascorePregameFormResponse,
  type SofascorePregameTeam,
  type SofascoreApiStandingRow,
} from "../../../football/infrastructure/providers/sofascore-browser/SofascoreSessionClient";

export class SofascorePregameFormContextProvider
  implements MatchContextProvider
{
  constructor(
    private readonly client:
      SofascoreSessionClient
  ) {}

  public supports(
    provider:
      string
  ): boolean {

    return provider ===
      "sofascore";
  }

  public async getContext(
    externalId:
      string
  ): Promise<
    MatchContext
  > {

    const eventId =
      Number(
        externalId
      );

    if (
      !Number.isFinite(
        eventId
      )
    ) {
      throw new Error(
        `Invalid SofaScore event id: ${externalId}`
      );
    }

    /*
     * ========================================
     * PARTIDO + PREGAME FORM
     * ========================================
     */
    const [
      event,
      pregame,
    ] =
      await Promise.all([
        this.client
          .getEvent(
            eventId
          ),

        this.getPregameFormSafe(
          eventId
        ),
      ]);

    /*
     * ========================================
     * ÚLTIMOS PARTIDOS
     * ========================================
     *
     * Se consultan independientemente.
     *
     * Si uno falla, NO rompemos todo
     * el MatchContext.
     */
const [
  homeEvents,
  awayEvents,
  standings,
] =
  await Promise.all([
    this.getTeamLastEventsSafe(
      event.homeTeam
        ?.id
    ),

    this.getTeamLastEventsSafe(
      event.awayTeam
        ?.id
    ),

    this.getStandingsSafe(
      event.tournament
        ?.id,

      event.season
        ?.id
    ),
  ]);

const homeRecentMatches =
  this.buildRecentMatches(
    event.homeTeam
      ?.id,

    event.id,

    homeEvents,

    standings
  );

   const awayRecentMatches =
  this.buildRecentMatches(
    event.awayTeam
      ?.id,

    event.id,

    awayEvents,

    standings
  );

return this.buildContext(
  event,
  pregame,
  externalId,
  homeRecentMatches,
  awayRecentMatches,
  standings
);
  }

  /*
   * ========================================
   * SAFE REQUESTS
   * ========================================
   */

  private async getPregameFormSafe(
    eventId:
      number
  ): Promise<
    SofascorePregameFormResponse | null
  > {

    try {
      return await this.client
        .getPregameForm(
          eventId
        );
    } catch (
      error
    ) {

      console.warn(
        "[SofascorePregameFormContextProvider] pregame-form unavailable",
        eventId,
        error instanceof Error
          ? error.message
          : error
      );

      return null;
    }
  }

  private async getTeamLastEventsSafe(
    teamId:
      number | undefined
  ): Promise<
    SofascoreApiLiveEvent[]
  > {

    if (
      typeof teamId !==
        "number" ||
      !Number.isFinite(
        teamId
      )
    ) {
      return [];
    }

    try {

      return await this.client
        .getTeamLastEvents(
          teamId,
          0
        );

    } catch (
      error
    ) {

      console.warn(
        "[SofascorePregameFormContextProvider] team last events unavailable",
        teamId,
        error instanceof Error
          ? error.message
          : error
      );

      return [];
    }
  }
  private async getStandingsSafe(
  tournamentId:
    number | undefined,

  seasonId:
    number | undefined
): Promise<
  SofascoreApiStandingRow[]
> {

  if (
    typeof tournamentId !==
      "number" ||
    typeof seasonId !==
      "number" ||
    !Number.isFinite(
      tournamentId
    ) ||
    !Number.isFinite(
      seasonId
    )
  ) {
    return [];
  }

  try {
    return await this.client
      .getStandings(
        tournamentId,
        seasonId
      );
  } catch (
    error
  ) {

    console.warn(
      "[SofascorePregameFormContextProvider] standings unavailable",
      tournamentId,
      seasonId,
      error instanceof Error
        ? error.message
        : error
    );

    return [];
  }
}

  /*
   * ========================================
   * CONTEXT
   * ========================================
   */

private buildContext(
  event:
    SofascoreApiLiveEvent,

  pregame:
    SofascorePregameFormResponse | null,

  externalId:
    string,

  homeRecentMatches:
    RecentTeamMatch[],

  awayRecentMatches:
    RecentTeamMatch[],

  standings:
    SofascoreApiStandingRow[]
): MatchContext {
const home =
  this.buildTeamContext(
    event.homeTeam
      ?.id,

    event.homeTeam
      ?.name ??
      "Home",

    pregame
      ?.homeTeam,

    pregame
      ?.label,

    homeRecentMatches,

    standings
  );

   const away =
  this.buildTeamContext(
    event.awayTeam
      ?.id,

    event.awayTeam
      ?.name ??
      "Away",

    pregame
      ?.awayTeam,

    pregame
      ?.label,

    awayRecentMatches,

    standings
  );

    const standingsAvailable =
      home.position !==
        null ||
      away.position !==
        null ||
      home.points !==
        null ||
      away.points !==
        null;

    const recentFormAvailable =
      home.form.length >
        0 ||
      away.form.length >
        0 ||
      home.recentMatches.length >
        0 ||
      away.recentMatches.length >
        0;

    const competitionName =
      event.tournament
        ?.name ??
      event.tournament
        ?.uniqueTournament
        ?.name ??
      "";

    const country =
      event.tournament
        ?.category
        ?.country
        ?.name ??
      event.tournament
        ?.category
        ?.name ??
      "";

    const format =
      this.detectFormat(
        competitionName,
        standingsAvailable
      );

    return {
      source: {
        provider:
          "sofascore",

        externalId,
      },

      competition: {
        name:
          competitionName,

        country,

        format,

        tableAvailable:
          standingsAvailable,

        tableScope:
          standingsAvailable
            ? "competition"
            : "none",

        annualDomesticTableAvailable:
          false,

        note:
          this.buildNote(
            standingsAvailable,
            recentFormAvailable,
            Boolean(
              pregame
            )
          ),
      },

      home,

      away,

      lineups: {
        status:
          "unavailable",

        homeFormation:
          null,

        awayFormation:
          null,

        homeStarters:
          null,

        awayStarters:
          null,
      },

      availability: {
        details:
          true,

        standings:
          standingsAvailable,

        recentForm:
          recentFormAvailable,

        lineups:
          false,
      },

      fetchedAt:
        new Date()
          .toISOString(),
    };
  }

  /*
   * ========================================
   * TEAM CONTEXT
   * ========================================
   */

  private buildTeamContext(
    teamId:
      number | undefined,

    teamName:
      string,

    pregame:
      SofascorePregameTeam | undefined,

    label:
      string | undefined,

    recentMatches:
      RecentTeamMatch[],
	standings:
  SofascoreApiStandingRow[]
  ): TeamMatchContext {

    const row =
  this.findStandingRow(
    teamId,
    standings
  );

const position =
  this.numberOrNull(
    row?.position
  ) ??
  this.numberOrNull(
    pregame?.position
  );

const points =
  this.numberOrNull(
    row?.points
  ) ??
  (
    this.isPointsLabel(
      label
    )
      ? this.numberOrNull(
          pregame?.value
        )
      : null
  );

const played =
  this.numberOrNull(
    row?.matches
  );

const wins =
  this.numberOrNull(
    row?.wins
  );

const draws =
  this.numberOrNull(
    row?.draws
  );

const losses =
  this.numberOrNull(
    row?.losses
  );

const goalsFor =
  this.numberOrNull(
    row?.scoresFor
  );

const goalsAgainst =
  this.numberOrNull(
    row?.scoresAgainst
  );

const goalDifference =
  goalsFor !==
    null &&
  goalsAgainst !==
    null
    ? goalsFor -
      goalsAgainst
    : null;

const goalsPerMatch =
  played !==
    null &&
  played >
    0 &&
  goalsFor !==
    null
    ? goalsFor /
      played
    : null;

const concededPerMatch =
  played !==
    null &&
  played >
    0 &&
  goalsAgainst !==
    null
    ? goalsAgainst /
      played
    : null; 

	const form =
      recentMatches.length >
        0
        ? recentMatches
            .map(
              item =>
                item.result
            )
        : this.normalizeForm(
            pregame
              ?.form
          );

    return {
  id:
    typeof teamId ===
      "number"
      ? String(
          teamId
        )
      : null,

  name:
    teamName,

  position,

  points,

  played,

  wins,

  draws,

  losses,

  goalsFor,

  goalsAgainst,

  goalDifference,

  goalsPerMatch,

  concededPerMatch,

  form,

  recentMatches,
};
  }

  /*
   * ========================================
   * ÚLTIMOS 5 PARTIDOS
   * ========================================
   */

private buildRecentMatches(
  teamId:
    number | undefined,

  currentEventId:
    number | undefined,

  events:
    SofascoreApiLiveEvent[],

  standings:
    SofascoreApiStandingRow[]
): RecentTeamMatch[] {

    if (
      typeof teamId !==
        "number"
    ) {
      return [];
    }

    /*
     * SofaScore no necesariamente devuelve
     * /events/last/0 del más reciente
     * al más antiguo.
     *
     * Lo verificamos empíricamente.
     *
     * Por eso ordenamos explícitamente.
     */
    const sorted =
      [
        ...events,
      ]
        .filter(
          event => {

            if (
              event.status
                ?.type !==
              "finished"
            ) {
              return false;
            }

            if (
              typeof event.id ===
                "number" &&
              typeof currentEventId ===
                "number" &&
              event.id ===
                currentEventId
            ) {
              return false;
            }

            const isHome =
              event.homeTeam
                ?.id ===
              teamId;

            const isAway =
              event.awayTeam
                ?.id ===
              teamId;

            if (
              !isHome &&
              !isAway
            ) {
              return false;
            }

            const homeGoals =
              this.numberOrNull(
                event.homeScore
                  ?.current
              );

            const awayGoals =
              this.numberOrNull(
                event.awayScore
                  ?.current
              );

            return (
              homeGoals !==
                null &&
              awayGoals !==
                null
            );
          }
        )
        .sort(
          (
            a,
            b
          ) => {

            const aTimestamp =
              this.numberOrNull(
                a.startTimestamp
              ) ??
              0;

            const bTimestamp =
              this.numberOrNull(
                b.startTimestamp
              ) ??
              0;

            return (
              bTimestamp -
              aTimestamp
            );
          }
        );

    const result:
      RecentTeamMatch[] =
      [];

    for (
      const event
      of sorted
    ) {

      if (
        result.length >=
        5
      ) {
        break;
      }

      const recent =
        this.toRecentMatch(
  teamId,
  event,
  standings
);

      if (
        recent
      ) {
        result.push(
          recent
        );
      }
    }

    return result;
  }

private toRecentMatch(
  teamId:
    number,

  event:
    SofascoreApiLiveEvent,

  standings:
    SofascoreApiStandingRow[]
): RecentTeamMatch | null {

    const isHome =
      event.homeTeam
        ?.id ===
      teamId;

    const isAway =
      event.awayTeam
        ?.id ===
      teamId;

    if (
      !isHome &&
      !isAway
    ) {
      return null;
    }

    const homeGoals =
      this.numberOrNull(
        event.homeScore
          ?.current
      );

    const awayGoals =
      this.numberOrNull(
        event.awayScore
          ?.current
      );

    if (
      homeGoals ===
        null ||
      awayGoals ===
        null
    ) {
      return null;
    }

    const opponent =
      isHome
        ? event.awayTeam
        : event.homeTeam;

    if (
      !opponent
        ?.name
    ) {
      return null;
    }

    const goalsFor =
      isHome
        ? homeGoals
        : awayGoals;

    const goalsAgainst =
      isHome
        ? awayGoals
        : homeGoals;

    const playedAt =
      typeof event
        .startTimestamp ===
        "number"
        ? new Date(
            event.startTimestamp *
            1000
          )
            .toISOString()
        : null;
		const opponentPosition =
  this.findStandingRow(
    opponent.id,
    standings
  )
    ?.position ??
  null;

    return {
      id:
        typeof event.id ===
          "number"
          ? String(
              event.id
            )
          : null,

      result:
        this.resultFromScore(
          goalsFor,
          goalsAgainst
        ),

      opponentName:
        opponent.name,

      /*
       * Los últimos eventos no incluyen
       * posición del rival.
       *
       * No inventamos.
       */
     opponentPosition:
  opponentPosition,

      homeAway:
        isHome
          ? "home"
          : "away",

      goalsFor,

      goalsAgainst,

      playedAt,
    };
  }

  private resultFromScore(
    goalsFor:
      number,

    goalsAgainst:
      number
  ): RecentResult {

    if (
      goalsFor >
      goalsAgainst
    ) {
      return "W";
    }

    if (
      goalsFor <
      goalsAgainst
    ) {
      return "L";
    }

    return "D";
  }

  /*
   * ========================================
   * FORM
   * ========================================
   */

  private normalizeForm(
    value:
      string[] | undefined
  ): RecentResult[] {

    if (
      !Array.isArray(
        value
      )
    ) {
      return [];
    }

    return value
      .map(
        item =>
          String(
            item
          )
            .trim()
            .toUpperCase()
      )
      .filter(
        (
          item
        ): item is
          RecentResult =>
            item ===
              "W" ||
            item ===
              "D" ||
            item ===
              "L"
      )
      .slice(
        0,
        5
      );
  }

  /*
   * ========================================
   * HELPERS
   * ========================================
   */

  private isPointsLabel(
    value:
      string | undefined
  ): boolean {

    if (
      !value
    ) {
      return false;
    }

    const normalized =
      value
        .normalize(
          "NFD"
        )
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .trim()
        .toLowerCase();

    return (
      normalized ===
        "pts" ||
      normalized.includes(
        "point"
      ) ||
      normalized.includes(
        "punto"
      )
    );
  }


  private findStandingRow(
  teamId:
    number | undefined,

  standings:
    SofascoreApiStandingRow[]
): SofascoreApiStandingRow | null {

  if (
    typeof teamId !==
      "number"
  ) {
    return null;
  }

  return (
    standings.find(
      row =>
        row.team
          ?.id ===
        teamId
    ) ??
    null
  );
}

  private numberOrNull(
    value:
      unknown
  ): number | null {

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return value;
    }

    if (
      typeof value ===
      "string"
    ) {

      const trimmed =
        value.trim();

      if (
        !trimmed
      ) {
        return null;
      }

      const parsed =
        Number(
          trimmed
        );

      return Number.isFinite(
        parsed
      )
        ? parsed
        : null;
    }

    return null;
  }

  private detectFormat(
    competitionName:
      string,

    standingsAvailable:
      boolean
  ): CompetitionFormat {

    const name =
      competitionName
        .normalize(
          "NFD"
        )
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase();

    if (
      /friendly|amistoso/
        .test(
          name
        )
    ) {
      return "friendly";
    }

    if (
      /playoff|play-off/
        .test(
          name
        )
    ) {
      return "playoff";
    }

    if (
      /qualif|qualification|clasificacion/
        .test(
          name
        )
    ) {
      return "qualifier";
    }

    if (
      /\bcup\b|\bcopa\b|pokal|coppa/
        .test(
          name
        )
    ) {
      return "cup";
    }

    if (
      standingsAvailable
    ) {
      return "table";
    }

    return "unknown";
  }

  private buildNote(
    standings:
      boolean,

    recentForm:
      boolean,

    pregameAvailable:
      boolean
  ): string {

    if (
      standings &&
      recentForm
    ) {
      return (
        "Posición, puntos y últimos partidos " +
        "obtenidos de SofaScore."
      );
    }

    if (
      standings
    ) {
      return (
        "Posición y puntos obtenidos " +
        "de SofaScore."
      );
    }

    if (
      recentForm
    ) {
      return (
        "Últimos partidos obtenidos " +
        "de SofaScore."
      );
    }

    if (
      pregameAvailable
    ) {
      return (
        "SofaScore respondió pregame-form, " +
        "pero no incluyó clasificación ni forma."
      );
    }

    return (
      "Contexto adicional de SofaScore " +
      "no disponible para este partido."
    );
  }
}
