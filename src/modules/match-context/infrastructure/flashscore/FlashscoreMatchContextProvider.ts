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
  FlashscoreMatchContextClient,
  type FlashscoreH2HResponse,
  type FlashscoreLineupsResponse,
  type FlashscoreRecentMatch,
  type FlashscoreStandingRow,
  type FlashscoreStandingsResponse,
  type FlashscoreTeamRef,
} from "./FlashscoreMatchContextClient";

export class FlashscoreMatchContextProvider
  implements MatchContextProvider
{
  constructor(
    private readonly client:
      FlashscoreMatchContextClient
  ) {}

  public supports(
    provider:
      string
  ): boolean {

    return provider ===
      "flashscore";
  }

  public async getContext(
    externalId:
      string
  ): Promise<
    MatchContext
  > {

    const details =
      await this.client
        .getDetails(
          externalId
        );

    const [
      standingsResult,
      h2hResult,
      lineupsResult,
    ] =
      await Promise.allSettled([
        this.client
          .getStandings(
            externalId
          ),

        this.client
          .getH2H(
            externalId
          ),

        this.client
          .getLineups(
            externalId
          ),
      ]);

    const standings =
      standingsResult.status ===
        "fulfilled"
        ? standingsResult.value
        : null;

    const h2h =
      h2hResult.status ===
        "fulfilled"
        ? h2hResult.value
        : null;

    const lineups =
      lineupsResult.status ===
        "fulfilled"
        ? lineupsResult.value
        : null;

    const rows =
      standings
        ?.standings ??
      [];

    const homeRow =
      this.findStanding(
        rows,
        details.home
      );

    const awayRow =
      this.findStanding(
        rows,
        details.away
      );

    const home =
      this.buildTeamContext(
        details.home,
        homeRow,
        rows,
        h2h
      );

    const away =
      this.buildTeamContext(
        details.away,
        awayRow,
        rows,
        h2h
      );

    const tableAvailable =
      rows.length >
      0;

    const format =
      this.detectFormat(
        details.competition
          .name,
        tableAvailable
      );

    return {
      source: {
        provider:
          "flashscore",

        externalId,
      },

      competition: {
        name:
          details.competition
            .name,

        country:
          details.competition
            .country
            ?.name ??
          "",

        format,

        tableAvailable,

        tableScope:
          tableAvailable
            ? "competition"
            : "none",

        /*
         * Esto lo añadiremos después
         * resolviendo la liga doméstica
         * del equipo cuando esté jugando
         * una copa.
         */
        annualDomesticTableAvailable:
          false,

        note:
          this.competitionNote(
            format,
            tableAvailable
          ),
      },

      home,

      away,

      lineups:
        this.buildLineups(
          lineups
        ),

      availability: {
        details:
          true,

        standings:
          tableAvailable,

        recentForm:
          home.recentMatches
            .length >
            0 ||
          away.recentMatches
            .length >
            0,

        lineups:
          Boolean(
            lineups
          ),
      },

      fetchedAt:
        new Date()
          .toISOString(),
    };
  }

  private findStanding(
    rows:
      FlashscoreStandingRow[],

    team:
      FlashscoreTeamRef
  ):
    FlashscoreStandingRow |
    null {

    if (
      team.id
    ) {
      const byId =
        rows.find(
          (
            row
          ) =>
            row.team.id ===
            team.id
        );

      if (byId) {
        return byId;
      }
    }

    const name =
      this.normalize(
        team.name
      );

    return (
      rows.find(
        (
          row
        ) =>
          this.normalize(
            row.team.name
          ) ===
          name
      ) ??
      null
    );
  }

  private buildTeamContext(
    team:
      FlashscoreTeamRef,

    standing:
      FlashscoreStandingRow |
      null,

    allRows:
      FlashscoreStandingRow[],

    h2h:
      FlashscoreH2HResponse |
      null
  ): TeamMatchContext {

    const recent =
      standing
        ?.recent_matches
        ?.filter(
          (
            item
          ) =>
            !(
              "is_upcoming"
              in item &&
              (
                item as {
                  is_upcoming?:
                    boolean;
                }
              )
                .is_upcoming
            )
        )
        .slice(
          0,
          5
        )
        .map(
          (
            item
          ) =>
            this.mapRecentMatch(
              item,
              team,
              allRows
            )
        )
        .filter(
          (
            item
          ):
            item is
              RecentTeamMatch =>
            item !==
            null
        ) ??
      [];

    const fallbackRecent =
      recent.length >
      0
        ? recent
        : this.recentFromH2H(
            team,
            h2h,
            allRows
          );

    const played =
      standing
        ?.matches_played ??
      null;

    const goalsFor =
      standing
        ?.goals_for ??
      null;

    const goalsAgainst =
      standing
        ?.goals_against ??
      null;

    return {
      id:
        team.id,

      name:
        team.name,

      position:
        standing
          ?.rank ??
        null,

      points:
        standing
          ?.points ??
        null,

      played,

      wins:
        standing
          ?.wins ??
        null,

      draws:
        standing
          ?.draws ??
        null,

      losses:
        standing
          ?.losses ??
        null,

      goalsFor,

      goalsAgainst,

      goalDifference:
        standing
          ?.goal_difference ??
        null,

      goalsPerMatch:
        this.average(
          goalsFor,
          played
        ),

      concededPerMatch:
        this.average(
          goalsAgainst,
          played
        ),

      form:
        fallbackRecent.map(
          (
            item
          ) =>
            item.result
        ),

      recentMatches:
        fallbackRecent,
    };
  }

  private recentFromH2H(
    team:
      FlashscoreTeamRef,

    h2h:
      FlashscoreH2HResponse |
      null,

    allRows:
      FlashscoreStandingRow[]
  ): RecentTeamMatch[] {

    if (
      !h2h?.sections
    ) {
      return [];
    }

    const normalizedTeam =
      this.normalize(
        team.name
      );

    const section =
      h2h.sections.find(
        (
          item
        ) => {

          const name =
            this.normalize(
              item.name
            );

          return (
            name.includes(
              "last matches"
            ) &&
            name.includes(
              normalizedTeam
            )
          );
        }
      );

    if (!section) {
      return [];
    }

    return section.matches
      .slice(
        0,
        5
      )
      .map(
        (
          match
        ) =>
          this.mapRecentMatch(
            match,
            team,
            allRows
          )
      )
      .filter(
        (
          item
        ):
          item is
            RecentTeamMatch =>
          item !==
          null
      );
  }

  private mapRecentMatch(
    match:
      FlashscoreRecentMatch,

    team:
      FlashscoreTeamRef,

    allRows:
      FlashscoreStandingRow[]
  ):
    RecentTeamMatch |
    null {

    const isHome =
      this.sameTeam(
        match.home,
        team
      );

    const isAway =
      this.sameTeam(
        match.away,
        team
      );

    if (
      !isHome &&
      !isAway
    ) {
      return null;
    }

    const ownGoals =
      isHome
        ? match.home_score
        : match.away_score;

    const opponentGoals =
      isHome
        ? match.away_score
        : match.home_score;

    if (
      ownGoals ===
        null ||
      opponentGoals ===
        null
    ) {
      return null;
    }

    const opponent =
      isHome
        ? match.away
        : match.home;

    const opponentStanding =
      this.findStanding(
        allRows,
        opponent
      );

    return {
      id:
        match.id ??
        null,

      result:
        this.result(
          match.result,
          ownGoals,
          opponentGoals
        ),

      opponentName:
        opponent.name,

      opponentPosition:
        opponentStanding
          ?.rank ??
        null,

      homeAway:
        isHome
          ? "home"
          : "away",

      goalsFor:
        ownGoals,

      goalsAgainst:
        opponentGoals,

      playedAt:
        match.start_time ??
        match.date ??
        null,
    };
  }

  private buildLineups(
    lineups:
      FlashscoreLineupsResponse |
      null
  ) {

    if (
      !lineups
    ) {
      return {
        status:
          "unavailable" as const,

        homeFormation:
          null,

        awayFormation:
          null,

        homeStarters:
          null,

        awayStarters:
          null,
      };
    }

    const homeStarters =
      this.startingCount(
        lineups.home
      );

    const awayStarters =
      this.startingCount(
        lineups.away
      );

    const confirmed =
      homeStarters >=
        11 &&
      awayStarters >=
        11;

    const partial =
      homeStarters >
        0 ||
      awayStarters >
        0;

    return {
      status:
        confirmed
          ? "confirmed" as const
          : partial
            ? "partial" as const
            : "unavailable" as const,

      homeFormation:
        lineups.home
          ?.formation ??
        null,

      awayFormation:
        lineups.away
          ?.formation ??
        null,

      homeStarters:
        homeStarters >
        0
          ? homeStarters
          : null,

      awayStarters:
        awayStarters >
        0
          ? awayStarters
          : null,
    };
  }

  private startingCount(
    side:
      FlashscoreLineupsResponse[
        "home"
      ]
  ): number {

    const groups =
      side?.groups ??
      [];

    const group =
      groups.find(
        (
          item
        ) =>
          this.normalize(
            item.name
          ).includes(
            "starting"
          )
      );

    return group
      ?.players
      ?.length ??
      0;
  }

  private result(
    explicit:
      FlashscoreRecentMatch[
        "result"
      ],

    own:
      number,

    opponent:
      number
  ): RecentResult {

    if (
      explicit ===
      "win"
    ) {
      return "W";
    }

    if (
      explicit ===
      "loss"
    ) {
      return "L";
    }

    if (
      explicit ===
      "draw"
    ) {
      return "D";
    }

    if (
      own >
      opponent
    ) {
      return "W";
    }

    if (
      own <
      opponent
    ) {
      return "L";
    }

    return "D";
  }

  private average(
    value:
      number | null,

    played:
      number | null
  ): number | null {

    if (
      value ===
        null ||
      played ===
        null ||
      played <=
        0
    ) {
      return null;
    }

    return Number(
      (
        value /
        played
      ).toFixed(
        2
      )
    );
  }

  private sameTeam(
    left:
      FlashscoreTeamRef,

    right:
      FlashscoreTeamRef
  ): boolean {

    if (
      left.id &&
      right.id
    ) {
      return left.id ===
        right.id;
    }

    return (
      this.normalize(
        left.name
      ) ===
      this.normalize(
        right.name
      )
    );
  }

  private detectFormat(
    competition:
      string,

    hasTable:
      boolean
  ): CompetitionFormat {

    const name =
      this.normalize(
        competition
      );

    if (
      name.includes(
        "friendly"
      )
    ) {
      return "friendly";
    }

    if (
      name.includes(
        "qualification"
      ) ||
      name.includes(
        "qualifying"
      )
    ) {
      return "qualifier";
    }

    if (
      name.includes(
        "play off"
      ) ||
      name.includes(
        "playoff"
      )
    ) {
      return "playoff";
    }

    if (
      name.includes(
        "cup"
      ) ||
      name.includes(
        "copa"
      ) ||
      name.includes(
        "pokal"
      ) ||
      name.includes(
        "trophy"
      ) ||
      name.includes(
        "coupe"
      )
    ) {
      return "cup";
    }

    if (
      hasTable
    ) {
      return "table";
    }

    return "unknown";
  }

  private competitionNote(
    format:
      CompetitionFormat,

    tableAvailable:
      boolean
  ): string | null {

    if (
      tableAvailable
    ) {
      return "Tabla correspondiente a esta competición.";
    }

    if (
      format ===
        "cup" ||
      format ===
        "playoff"
    ) {
      return "Este torneo no expone una tabla general para este partido.";
    }

    return null;
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
      .toLowerCase()
      .replace(
        /[-_.]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      );
  }
}
