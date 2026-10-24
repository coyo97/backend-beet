import type {
  RecentTeamMatch,
  TeamMatchContext,
} from "../../../match-context/domain/entities/MatchContext";

import type {
  CommonOpponentComparison,
  CommonOpponentSummary,
  TeamVsCommonOpponentSummary,
} from "../entities/MatchOpponentAnalysis";

export class CommonOpponentAnalyzer {

  public analyze(
    home:
      TeamMatchContext,

    away:
      TeamMatchContext,

    limit =
      5
  ): CommonOpponentSummary {

    const homeGroups =
      this.groupByOpponent(
        home.recentMatches
          .slice(
            0,
            limit
          )
      );

    const awayGroups =
      this.groupByOpponent(
        away.recentMatches
          .slice(
            0,
            limit
          )
      );

    const comparisons:
      CommonOpponentComparison[] =
      [];

    for (
      const [
        normalizedName,
        homeMatches,
      ]
      of homeGroups
    ) {

      const awayMatches =
        awayGroups.get(
          normalizedName
        );

      if (
        !awayMatches ||
        awayMatches.length ===
          0
      ) {
        continue;
      }

      const homeSummary =
        this.summarize(
          homeMatches
        );

      const awaySummary =
        this.summarize(
          awayMatches
        );

      const opponentPosition =
        this.resolvePosition(
          homeMatches,
          awayMatches
        );

      comparisons.push({
        opponentName:
          homeMatches[0]
            .opponentName,

        opponentPosition,

        sameVenueContext:
          homeSummary
            .venues
            .some(
              venue =>
                awaySummary
                  .venues
                  .includes(
                    venue
                  )
            ),

        homeTeam:
          homeSummary,

        awayTeam:
          awaySummary,
      });
    }

    /*
     * Primero mostramos rivales mejor
     * posicionados.
     *
     * Los que no tienen posición van
     * al final.
     */
    comparisons.sort(
      (
        a,
        b
      ) =>
        (
          a.opponentPosition ??
          Number.MAX_SAFE_INTEGER
        ) -
        (
          b.opponentPosition ??
          Number.MAX_SAFE_INTEGER
        )
    );

    return {
      count:
        comparisons.length,

      sameVenueContextCount:
        comparisons.filter(
          item =>
            item.sameVenueContext
        ).length,

      homePoints:
        comparisons.reduce(
          (
            total,
            item
          ) =>
            total +
            item.homeTeam
              .points,
          0
        ),

      awayPoints:
        comparisons.reduce(
          (
            total,
            item
          ) =>
            total +
            item.awayTeam
              .points,
          0
        ),

      homeGoalsFor:
        comparisons.reduce(
          (
            total,
            item
          ) =>
            total +
            item.homeTeam
              .goalsFor,
          0
        ),

      homeGoalsAgainst:
        comparisons.reduce(
          (
            total,
            item
          ) =>
            total +
            item.homeTeam
              .goalsAgainst,
          0
        ),

      awayGoalsFor:
        comparisons.reduce(
          (
            total,
            item
          ) =>
            total +
            item.awayTeam
              .goalsFor,
          0
        ),

      awayGoalsAgainst:
        comparisons.reduce(
          (
            total,
            item
          ) =>
            total +
            item.awayTeam
              .goalsAgainst,
          0
        ),

      comparisons,
    };
  }

  private groupByOpponent(
    matches:
      RecentTeamMatch[]
  ): Map<
    string,
    RecentTeamMatch[]
  > {

    const groups =
      new Map<
        string,
        RecentTeamMatch[]
      >();

    for (
      const match
      of matches
    ) {

      const key =
        this.normalizeName(
          match.opponentName
        );

      if (!key) {
        continue;
      }

      const current =
        groups.get(
          key
        ) ??
        [];

      current.push(
        match
      );

      groups.set(
        key,
        current
      );
    }

    return groups;
  }

  private summarize(
    matches:
      RecentTeamMatch[]
  ):
    TeamVsCommonOpponentSummary {

    let wins =
      0;

    let draws =
      0;

    let losses =
      0;

    let goalsFor =
      0;

    let goalsAgainst =
      0;

    const venues =
      new Set<
        "home" |
        "away"
      >();

    for (
      const match
      of matches
    ) {

      goalsFor +=
        match.goalsFor;

      goalsAgainst +=
        match.goalsAgainst;

      venues.add(
        match.homeAway
      );

      switch (
        match.result
      ) {

        case "W":
          wins +=
            1;
          break;

        case "D":
          draws +=
            1;
          break;

        case "L":
          losses +=
            1;
          break;
      }
    }

    return {
      matches:
        matches.length,

      wins,

      draws,

      losses,

      points:
        wins *
          3 +
        draws,

      goalsFor,

      goalsAgainst,

      goalDifference:
        goalsFor -
        goalsAgainst,

      venues:
        Array.from(
          venues
        ),

      results:
        matches.map(
          match =>
            match.result
        ),
    };
  }

  private resolvePosition(
    homeMatches:
      RecentTeamMatch[],

    awayMatches:
      RecentTeamMatch[]
  ): number |
    null {

    const positions =
      [
        ...homeMatches,
        ...awayMatches,
      ]
        .map(
          match =>
            match.opponentPosition
        )
        .filter(
          (
            value
          ): value is number =>
            typeof value ===
              "number" &&
            Number.isFinite(
              value
            ) &&
            value >
              0
        );

    if (
      positions.length ===
      0
    ) {
      return null;
    }

    /*
     * Normalmente será la misma posición
     * actual del rival.
     *
     * Si dos fuentes/contextos discrepan,
     * evitamos escoger arbitrariamente
     * uno: usamos media.
     */
    const average =
      positions.reduce(
        (
          total,
          position
        ) =>
          total +
          position,
        0
      ) /
      positions.length;

    return Math.round(
      average *
      10
    ) /
      10;
  }

  private normalizeName(
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
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .trim()
      .replace(
        /\s+/g,
        " "
      );
  }
}
