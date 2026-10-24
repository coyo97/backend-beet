import type {
  MatchLineupPlayer,
  MatchLineupSnapshot,
  MatchLineupTeam,
} from "../entities/MatchLineupSnapshot";

import type {
  CurrentStarterAssessment,
  LineupHistoryConfidence,
  RotationLevel,
  StarterFrequency,
  StarterHistoryStat,
  TeamLineupAnalysis,
} from "../entities/LineupAnalysis";

interface MutablePlayerStat {
  playerId:
    string | null;

  name:
    string;

  position:
    string | null;

  starts:
    number;
}

export class TeamStarterProfiler {

  public analyze(
    current:
      MatchLineupTeam,

    history:
      MatchLineupSnapshot[]
  ): TeamLineupAnalysis {

    const relevantHistory =
      history
        .map(
          snapshot =>
            this.teamFromSnapshot(
              snapshot,
              current.teamId
            )
        )
        .filter(
          (
            team
          ): team is MatchLineupTeam =>
            team !==
            null
        );

    const historicalMatches =
      relevantHistory.length;

    const stats =
      this.buildHistoryStats(
        relevantHistory,
        historicalMatches
      );

    const statsByKey =
      new Map<
        string,
        StarterHistoryStat
      >();

    for (
      const stat
      of stats
    ) {
      statsByKey.set(
        this.playerKey(
          stat
        ),
        stat
      );
    }

    const currentStarters =
      current.starters.map(
        player =>
          this.assessCurrentPlayer(
            player,
            statsByKey,
            historicalMatches
          )
      );

    const habitualPool =
      stats.filter(
        stat =>
          stat.frequency ===
          "habitual"
      );

    const currentKeys =
      new Set(
        current.starters.map(
          player =>
            this.playerKey(
              player
            )
        )
      );

    const habitualMissing =
      habitualPool.filter(
        player =>
          !currentKeys.has(
            this.playerKey(
              player
            )
          )
      );

    const habitualPresent =
      habitualPool.length -
      habitualMissing.length;

    const habitualCoverage =
      habitualPool.length >
      0
        ? habitualPresent /
          habitualPool.length
        : null;

    const unseenCurrentStarters =
      currentStarters.filter(
        player =>
          player.frequency ===
          "unseen"
      ).length;

    return {
      teamId:
        current.teamId,

      teamName:
        current.teamName,

      historicalMatches,

      confidence:
        this.confidence(
          historicalMatches
        ),

      rotationLevel:
        this.rotationLevel(
          historicalMatches,
          habitualPool.length,
          habitualMissing.length,
          habitualCoverage,
          unseenCurrentStarters
        ),

      habitualPool,

      habitualPresent,

      habitualMissing,

      habitualCoverage,

      unseenCurrentStarters,

      currentStarters,
    };
  }

  private buildHistoryStats(
    teams:
      MatchLineupTeam[],

    matchesObserved:
      number
  ): StarterHistoryStat[] {

    const players =
      new Map<
        string,
        MutablePlayerStat
      >();

    /*
     * Los snapshots llegan del más
     * reciente al más antiguo.
     *
     * Conservamos nombre/posición del
     * registro más reciente conocido.
     */
    for (
      const team
      of teams
    ) {

      for (
        const player
        of team.starters
      ) {

        const key =
          this.playerKey(
            player
          );

        const existing =
          players.get(
            key
          );

        if (existing) {
          existing.starts +=
            1;

          continue;
        }

        players.set(
          key,
          {
            playerId:
              player.playerId,

            name:
              player.name,

            position:
              player.position,

            starts:
              1,
          }
        );
      }
    }

    return Array.from(
      players.values()
    )
      .map(
        player => {

          const startRate =
            matchesObserved >
            0
              ? player.starts /
                matchesObserved
              : 0;

          return {
            ...player,

            matchesObserved,

            startRate,

            frequency:
              this.frequency(
                startRate
              ),
          };
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          b.startRate -
            a.startRate ||
          b.starts -
            a.starts ||
          a.name.localeCompare(
            b.name
          )
      );
  }

  private assessCurrentPlayer(
    player:
      MatchLineupPlayer,

    stats:
      Map<
        string,
        StarterHistoryStat
      >,

    historicalMatches:
      number
  ): CurrentStarterAssessment {

    const historical =
      stats.get(
        this.playerKey(
          player
        )
      );

    if (!historical) {
      return {
        ...player,

        historyStarts:
          0,

        historyMatches:
          historicalMatches,

        startRate:
          null,

        frequency:
          "unseen",
      };
    }

    return {
      ...player,

      historyStarts:
        historical.starts,

      historyMatches:
        historical
          .matchesObserved,

      startRate:
        historical
          .startRate,

      frequency:
        historical
          .frequency,
    };
  }

  /*
   * Primera versión:
   *
   * >= 70% → habitual
   * 40-69% → rotación
   * < 40%  → ocasional
   */
  private frequency(
    startRate:
      number
  ): Exclude<
    StarterFrequency,
    "unseen"
  > {

    if (
      startRate >=
      0.7
    ) {
      return "habitual";
    }

    if (
      startRate >=
      0.4
    ) {
      return "rotation";
    }

    return "occasional";
  }

  private confidence(
    matches:
      number
  ): LineupHistoryConfidence {

    if (
      matches ===
      0
    ) {
      return "none";
    }

    if (
      matches <=
      2
    ) {
      return "low";
    }

    if (
      matches <=
      5
    ) {
      return "medium";
    }

    return "high";
  }

  private rotationLevel(
    historicalMatches:
      number,

    habitualPool:
      number,

    habitualMissing:
      number,

    habitualCoverage:
      number | null,

    unseenCurrent:
      number
  ): RotationLevel {

    /*
     * Con 1-2 partidos no queremos
     * afirmar que un XI está rotado.
     */
    if (
      historicalMatches <
      3
    ) {
      return "unknown";
    }

    if (
      habitualPool ===
        0 ||
      habitualCoverage ===
        null
    ) {
      return "unknown";
    }

    /*
     * Rotación alta:
     *
     * - faltan muchos habituales
     * - cobertura habitual < 65%
     * - aparecen >= 4 titulares nunca
     *   vistos como titulares antes.
     */
    if (
      habitualCoverage <
        0.65 ||
      habitualMissing >=
        4 ||
      unseenCurrent >=
        4
    ) {
      return "high";
    }

    /*
     * XI muy parecido al habitual.
     */
    if (
      habitualCoverage >=
        0.85 &&
      habitualMissing <=
        2 &&
      unseenCurrent <=
        2
    ) {
      return "low";
    }

    return "medium";
  }

  private teamFromSnapshot(
    snapshot:
      MatchLineupSnapshot,

    teamId:
      string | null
  ): MatchLineupTeam |
    null {

    if (!teamId) {
      return null;
    }

    if (
      snapshot.home
        .teamId ===
      teamId
    ) {
      return snapshot.home;
    }

    if (
      snapshot.away
        .teamId ===
      teamId
    ) {
      return snapshot.away;
    }

    return null;
  }

  private playerKey(
    player: {
      playerId:
        string | null;

      name:
        string;
    }
  ): string {

    if (
      player.playerId
    ) {
      return (
        "id:" +
        player.playerId
      );
    }

    return (
      "name:" +
      player.name
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
          /\s+/g,
          " "
        )
    );
  }
}
