import type {
  LiveMatch,
} from "../../../football/domain/entities/LiveMatch";

import type {
  MatchContext,
  RecentResult,
  TeamMatchContext,
} from "../../../match-context/domain/entities/MatchContext";

import type {
  MatchOpportunity,
  MatchOpportunityProfile,
  MatchOpportunitySignal,
  NotableRecentWin,
  OpportunitySide,
  TeamDangerLevel,
  TeamOpportunitySnapshot,
} from "../entities/MatchOpportunity";

const HOME_ADVANTAGE =
  4;

const MINIMUM_USEFUL_QUALITY =
  35;

function clamp(
  value:
    number,

  min:
    number,

  max:
    number
): number {

  return Math.min(
    Math.max(
      value,
      min
    ),
    max
  );
}

function round(
  value:
    number,

  digits =
    1
): number {

  const factor =
    10 **
    digits;

  return Math.round(
    value *
    factor
  ) /
    factor;
}

function formResultPoints(
  result:
    RecentResult
): number {

  switch (
    result
  ) {
    case "W":
      return 3;

    case "D":
      return 1;

    case "L":
    default:
      return 0;
  }
}

interface TeamScoreComponent {
  value:
    number;

  weight:
    number;
}

export class MatchOpportunityScorer {

  public score(
    match:
      LiveMatch,

    context:
      MatchContext
  ): MatchOpportunity {

    const home =
      this.scoreTeam(
        context.home
      );

    const away =
      this.scoreTeam(
        context.away
      );

    /*
     * Posición:
     *
     * #2 vs #14
     *
     * El local tiene una ventaja de
     * 12 puestos.
     *
     * Limitamos el efecto para evitar
     * que la tabla domine todo el análisis.
     */
    const positionEdge =
      this.positionEdge(
        context.home,
        context.away
      );

    const homeMatchStrength =
      clamp(
        home.strength +
        HOME_ADVANTAGE +
        positionEdge /
          2,
        0,
        100
      );

    const awayMatchStrength =
      clamp(
        away.strength -
        positionEdge /
          2,
        0,
        100
      );

    home.matchStrength =
      round(
        homeMatchStrength
      );

    away.matchStrength =
      round(
        awayMatchStrength
      );

    const rawDifference =
      homeMatchStrength -
      awayMatchStrength;

    const favoredSide:
      OpportunitySide =
      Math.abs(
        rawDifference
      ) <
      0.5
        ? null
        : rawDifference >
            0
          ? "home"
          : "away";

    const rawGap =
      Math.abs(
        rawDifference
      );

    /*
     * Si el supuesto equipo débil viene
     * demostrando capacidad contra rivales
     * fuertes, reducimos la separación.
     *
     * No cambiamos quién es mejor según los
     * datos: bajamos la confianza de la
     * lectura "fuerte vs débil".
     */
    const underdog =
      favoredSide ===
        "home"
        ? away
        : favoredSide ===
            "away"
          ? home
          : null;

    const dangerPenalty =
      underdog
        ? Math.min(
            12,
            underdog
              .dangerScore *
              0.35
          )
        : 0;

    const adjustedGap =
      Math.max(
        0,
        rawGap -
        dangerPenalty
      );

    const dataQuality =
      Math.round(
        (
          home.dataQuality +
          away.dataQuality
        ) /
        2
      );

    const hasTable =
      context.home
        .position !==
        null &&
      context.away
        .position !==
        null;

    const profile =
      this.profile(
        adjustedGap,
        dataQuality
      );

    const signals =
      this.signals(
        home,
        away,
        favoredSide,
        adjustedGap
      );

    const reasons =
      this.reasons(
        context,
        home,
        away,
        favoredSide
      );

    const warnings =
      this.warnings(
        home,
        away,
        favoredSide,
        dataQuality
      );

    return {
      match,

      contextSource:
        context.source,

      profile,

      favoredSide,

      hasTable,

      dataQuality,

      rawGap:
        round(
          rawGap
        ),

      adjustedGap:
        round(
          adjustedGap
        ),

      home,

      away,

      signals,

      reasons,

      warnings,
    };
  }

  private scoreTeam(
    team:
      TeamMatchContext
  ): TeamOpportunitySnapshot {

    const form =
      team.form
        .slice(
          0,
          5
        );

    const formPoints =
      form.reduce(
        (
          total,
          result
        ) =>
          total +
          formResultPoints(
            result
          ),
        0
      );

    const formMaxPoints =
      form.length *
      3;

    const pointsPerGame =
      team.points !==
        null &&
      team.played !==
        null &&
      team.played >
        0
        ? team.points /
          team.played
        : null;

    const winRate =
      team.wins !==
        null &&
      team.played !==
        null &&
      team.played >
        0
        ? team.wins /
          team.played
        : null;

    const goalDifferencePerGame =
      this.goalDifferencePerGame(
        team
      );

    const components:
      TeamScoreComponent[] =
      [];

    /*
     * PPG
     *
     * Máximo teórico:
     * 3 puntos por partido.
     */
    if (
      pointsPerGame !==
      null
    ) {
      components.push({
        value:
          clamp(
            pointsPerGame /
            3,
            0,
            1
          ) *
          100,

        weight:
          35,
      });
    }

    /*
     * Forma reciente.
     *
     * 5 victorias = 15/15.
     * 5 derrotas  = 0/15.
     */
    if (
      formMaxPoints >
      0
    ) {
      components.push({
        value:
          (
            formPoints /
            formMaxPoints
          ) *
          100,

        weight:
          35,
      });
    }

    /*
     * Diferencia de goles por partido.
     *
     * -2 -> 0
     *  0 -> 50
     * +2 -> 100
     *
     * Valores más extremos se limitan.
     */
    if (
      goalDifferencePerGame !==
      null
    ) {

      const normalized =
        (
          clamp(
            goalDifferencePerGame,
            -2,
            2
          ) +
          2
        ) /
        4;

      components.push({
        value:
          normalized *
          100,

        weight:
          20,
      });
    }

    if (
      winRate !==
      null
    ) {
      components.push({
        value:
          clamp(
            winRate,
            0,
            1
          ) *
          100,

        weight:
          10,
      });
    }

    const availableWeight =
      components.reduce(
        (
          total,
          component
        ) =>
          total +
          component.weight,
        0
      );

    const strength =
      availableWeight >
        0
        ? components.reduce(
            (
              total,
              component
            ) =>
              total +
              component.value *
              component.weight,
            0
          ) /
          availableWeight
        : 50;

    const danger =
      this.danger(
        team,
        form
      );

    return {
      name:
        team.name,

      strength:
        round(
          strength
        ),

      /*
       * MatchStrength será calculado
       * después con posición + localía.
       */
      matchStrength:
        round(
          strength
        ),

      dataQuality:
        availableWeight,

      position:
        team.position,

      points:
        team.points,

      played:
        team.played,

      pointsPerGame:
        pointsPerGame !==
          null
          ? round(
              pointsPerGame,
              2
            )
          : null,

      wins:
        team.wins,

      draws:
        team.draws,

      losses:
        team.losses,

      winRate:
        winRate !==
          null
          ? round(
              winRate *
              100
            )
          : null,

      goalDifferencePerGame:
        goalDifferencePerGame !==
          null
          ? round(
              goalDifferencePerGame,
              2
            )
          : null,

      form,

      formPoints,

      formMaxPoints,

      recentMatchesCount:
        team.recentMatches
          .slice(
            0,
            5
          )
          .length,

      dangerScore:
        danger.score,

      dangerLevel:
        danger.level,

      notableWins:
        danger.notableWins,
    };
  }

  private goalDifferencePerGame(
    team:
      TeamMatchContext
  ): number | null {

    if (
      team.goalDifference !==
        null &&
      team.played !==
        null &&
      team.played >
        0
    ) {
      return (
        team.goalDifference /
        team.played
      );
    }

    if (
      team.goalsPerMatch !==
        null &&
      team.concededPerMatch !==
        null
    ) {
      return (
        team.goalsPerMatch -
        team.concededPerMatch
      );
    }

    return null;
  }

  private positionEdge(
    home:
      TeamMatchContext,

    away:
      TeamMatchContext
  ): number {

    if (
      home.position ===
        null ||
      away.position ===
        null
    ) {
      return 0;
    }

    /*
     * Local #2,
     * visitante #12:
     *
     * 12 - 2 = +10
     *
     * positivo = favorece local.
     */
    const gap =
      away.position -
      home.position;

    return clamp(
      gap *
      1.25,
      -15,
      15
    );
  }

  private danger(
    team:
      TeamMatchContext,

    form:
      RecentResult[]
  ): {
    score:
      number;

    level:
      TeamDangerLevel;

    notableWins:
      NotableRecentWin[];
  } {

    let score =
      0;

    const notableWins:
      NotableRecentWin[] =
      [];

    const recent =
      team.recentMatches
        .slice(
          0,
          5
        );

    for (
      const match
      of recent
    ) {

      if (
        match.result !==
          "W" ||
        match.opponentPosition ===
          null
      ) {
        continue;
      }

      const opponentPosition =
        match.opponentPosition;

      if (
        opponentPosition <=
        3
      ) {
        score +=
          18;

        notableWins.push({
          opponentName:
            match.opponentName,

          opponentPosition,

          reason:
            "top-3",
        });

        continue;
      }

      if (
        opponentPosition <=
        5
      ) {
        score +=
          12;

        notableWins.push({
          opponentName:
            match.opponentName,

          opponentPosition,

          reason:
            "top-5",
        });

        continue;
      }

      /*
       * Ejemplo:
       *
       * equipo #14 vence a #7.
       *
       * Aunque el rival no sea top 5,
       * sigue siendo una victoria contra
       * alguien bastante mejor ubicado.
       */
      if (
        team.position !==
          null &&
        opponentPosition <=
          team.position -
          5
      ) {
        score +=
          8;

        notableWins.push({
          opponentName:
            match.opponentName,

          opponentPosition,

          reason:
            "higher-ranked",
        });

        continue;
      }

      if (
        opponentPosition <=
        10
      ) {
        score +=
          4;
      }
    }

    const wins =
      form.filter(
        result =>
          result ===
          "W"
      ).length;

    const losses =
      form.filter(
        result =>
          result ===
          "L"
      ).length;

    if (
      wins >=
      4
    ) {
      score +=
        10;
    } else if (
      wins >=
      3
    ) {
      score +=
        6;
    }

    if (
      form.length >=
        4 &&
      losses ===
        0
    ) {
      score +=
        4;
    }

    score =
      Math.min(
        score,
        40
      );

    const level:
      TeamDangerLevel =
      score >=
        24
        ? "high"
        : score >=
            12
          ? "medium"
          : "low";

    return {
      score,

      level,

      notableWins:
        notableWins
          .slice(
            0,
            5
          ),
    };
  }

  private profile(
    gap:
      number,

    quality:
      number
  ): MatchOpportunityProfile {

    if (
      quality <
      MINIMUM_USEFUL_QUALITY
    ) {
      return "insufficient-data";
    }

    if (
      gap >=
      25
    ) {
      return "clear-favorite";
    }

    if (
      gap >=
      15
    ) {
      return "moderate-favorite";
    }

    if (
      gap >=
      8
    ) {
      return "slight-edge";
    }

    return "balanced";
  }

  private signals(
    home:
      TeamOpportunitySnapshot,

    away:
      TeamOpportunitySnapshot,

    favoredSide:
      OpportunitySide,

    gap:
      number
  ): MatchOpportunitySignal[] {

    const signals =
      new Set<
        MatchOpportunitySignal
      >();

    const normalizedHomeForm =
      home.formMaxPoints >
        0
        ? (
            home.formPoints /
            home.formMaxPoints
          ) *
          15
        : null;

    const normalizedAwayForm =
      away.formMaxPoints >
        0
        ? (
            away.formPoints /
            away.formMaxPoints
          ) *
          15
        : null;

    if (
      normalizedHomeForm !==
        null &&
      normalizedAwayForm !==
        null &&
      Math.abs(
        normalizedHomeForm -
        normalizedAwayForm
      ) >=
        6
    ) {
      signals.add(
        "form-mismatch"
      );
    }

    if (
      home.form.length >=
        5 &&
      home.form
        .slice(
          0,
          5
        )
        .every(
          result =>
            result ===
            "W"
        )
    ) {
      signals.add(
        "five-win-streak"
      );
    }

    if (
      away.form.length >=
        5 &&
      away.form
        .slice(
          0,
          5
        )
        .every(
          result =>
            result ===
            "W"
        )
    ) {
      signals.add(
        "five-win-streak"
      );
    }

    if (
      home.position !==
        null &&
      away.position !==
        null &&
      Math.abs(
        home.position -
        away.position
      ) >=
        5
    ) {
      signals.add(
        "table-gap"
      );
    }

    const underdog =
      favoredSide ===
        "home"
        ? away
        : favoredSide ===
            "away"
          ? home
          : null;

    if (
      underdog &&
      underdog.dangerLevel !==
        "low"
    ) {
      signals.add(
        "dangerous-underdog"
      );
    }

    if (
      gap >=
        15 &&
      favoredSide ===
        "home"
    ) {
      signals.add(
        "home-strong"
      );
    }

    if (
      gap >=
        15 &&
      favoredSide ===
        "away"
    ) {
      signals.add(
        "away-strong"
      );
    }

    return Array.from(
      signals
    );
  }

  private reasons(
    context:
      MatchContext,

    home:
      TeamOpportunitySnapshot,

    away:
      TeamOpportunitySnapshot,

    favoredSide:
      OpportunitySide
  ): string[] {

    const reasons:
      string[] =
      [];

    if (
      home.position !==
        null &&
      away.position !==
        null
    ) {
      reasons.push(
        `Tabla: ${home.name} #${home.position} vs ${away.name} #${away.position}`
      );
    }

    if (
      home.points !==
        null &&
      away.points !==
        null
    ) {
      reasons.push(
        `Puntos: ${home.points} vs ${away.points}`
      );
    }

    if (
      home.pointsPerGame !==
        null &&
      away.pointsPerGame !==
        null
    ) {
      reasons.push(
        `PPG: ${home.pointsPerGame} vs ${away.pointsPerGame}`
      );
    }

    if (
      home.formMaxPoints >
        0 &&
      away.formMaxPoints >
        0
    ) {
      reasons.push(
        `Últimos ${Math.max(
          home.form.length,
          away.form.length
        )}: ${home.name} ${home.form.join("-")} (${home.formPoints}/${home.formMaxPoints}) · ${away.name} ${away.form.join("-")} (${away.formPoints}/${away.formMaxPoints})`
      );
    }

    if (
      favoredSide ===
        "home"
    ) {
      reasons.push(
        `${home.name} tiene el índice contextual superior`
      );
    }

    if (
      favoredSide ===
        "away"
    ) {
      reasons.push(
        `${away.name} tiene el índice contextual superior`
      );
    }

    if (
      context.competition
        .tableAvailable ===
      false
    ) {
      reasons.push(
        "La competición no dispone de tabla utilizable"
      );
    }

    return reasons;
  }

  private warnings(
    home:
      TeamOpportunitySnapshot,

    away:
      TeamOpportunitySnapshot,

    favoredSide:
      OpportunitySide,

    dataQuality:
      number
  ): string[] {

    const warnings:
      string[] =
      [];

    const underdog =
      favoredSide ===
        "home"
        ? away
        : favoredSide ===
            "away"
          ? home
          : null;

    if (
      underdog &&
      underdog.dangerLevel ===
        "high"
    ) {
      warnings.push(
        `CUIDADO: ${underdog.name} tiene señales fuertes de rival peligroso pese a aparecer como inferior`
      );
    } else if (
      underdog &&
      underdog.dangerLevel ===
        "medium"
    ) {
      warnings.push(
        `CUIDADO: ${underdog.name} viene mostrando resultados que reducen la diferencia aparente`
      );
    }

    if (
      underdog &&
      underdog.notableWins.length >
        0
    ) {

      const victories =
        underdog.notableWins
          .map(
            win =>
              `${win.opponentName} (#${win.opponentPosition})`
          )
          .join(
            ", "
          );

      warnings.push(
        `Victorias recientes ante rivales mejor ubicados: ${victories}`
      );
    }

    if (
      dataQuality <
      60
    ) {
      warnings.push(
        `Datos incompletos: calidad contextual ${dataQuality}/100`
      );
    }

    return warnings;
  }
}
