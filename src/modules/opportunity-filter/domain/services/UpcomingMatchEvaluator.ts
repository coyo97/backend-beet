
import type {
  MatchOpportunity,
  TeamOpportunitySnapshot,
} from "../entities/MatchOpportunity";

type TeamPreview = Pick<
  TeamOpportunitySnapshot,
  | "name"
  | "position"
  | "points"
  | "played"
  | "pointsPerGame"
  | "form"
>;

/*
 * Compatible con MatchOpportunity.
 *
 * No repetimos su evaluacion.
 * Usamos los datos ya calculados
 * por MatchOpportunityScorer.
 */
export interface UpcomingEvaluationInput {
  match: {
    kickoffAt: string;
  };

  home: TeamPreview;
  away: TeamPreview;

  hasTable: boolean;
  dataQuality: number;

  favoredSide:
    MatchOpportunity["favoredSide"];
}

export interface UpcomingMatchEvaluation {
  level: "high" | "watch";

  leadingSide: "home" | "away";

  leadingTeam: string;
  opponentTeam: string;

  pointsGap: number;
  positionGap: number;

  dataQuality: number;
  kickoffAt: string;

  reasons: string[];
  warnings: string[];
}

function validNumber(
  value: number | null
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function winsInRecentForm(
  team: TeamPreview
): number {
  return team.form
    .slice(0, 5)
    .filter(
      result => result === "W"
    ).length;
}

export class UpcomingMatchEvaluator {

  /*
   * Evaluamos encuentros dentro
   * de las siguientes 48 horas.
   *
   * Incluye la ventana para
   * avisos 24 h antes.
   */
  private readonly horizonMs =
    48 * 60 * 60 * 1000;

  public evaluate(
    input: UpcomingEvaluationInput,
    nowMs = Date.now()
  ): UpcomingMatchEvaluation | null {

    const kickoffMs =
      Date.parse(
        input.match.kickoffAt
      );

    if (
      !Number.isFinite(kickoffMs) ||
      kickoffMs <= nowMs ||
      kickoffMs > nowMs + this.horizonMs
    ) {
      return null;
    }

    /*
     * Sin tabla comparable
     * no afirmamos diferencias
     * de posiciones y puntos.
     */
    if (
      !input.hasTable ||
      input.dataQuality < 45
    ) {
      return null;
    }

    const home = input.home;
    const away = input.away;

    if (
      !validNumber(home.points) ||
      !validNumber(away.points) ||
      !validNumber(home.position) ||
      !validNumber(away.position) ||
      home.position < 1 ||
      away.position < 1 ||
      home.points === away.points
    ) {
      return null;
    }

    /*
     * El equipo con mas puntos
     * debe estar tambien mejor
     * clasificado.
     */
    const leadingSide =
      home.points > away.points
        ? "home" as const
        : "away" as const;

    const leader =
      leadingSide === "home"
        ? home
        : away;

    const opponent =
      leadingSide === "home"
        ? away
        : home;

    if (
      leader.position === null ||
      opponent.position === null ||
      leader.points === null ||
      opponent.points === null ||
      leader.position >=
        opponent.position
    ) {
      return null;
    }

    const pointsGap =
      leader.points -
      opponent.points;

    const positionGap =
      opponent.position -
      leader.position;

    /*
     * Si la evaluacion global
     * del scorer contradice
     * al lider por puntos,
     * no enviamos esta alerta.
     */
    if (
      input.favoredSide !== null &&
      input.favoredSide !== leadingSide
    ) {
      return null;
    }

    /*
     * Diferentes cantidades de
     * partidos disputados pueden
     * distorsionar los puntos.
     */
    const bothPlayedKnown =
      validNumber(leader.played) &&
      validNumber(opponent.played);

    const playedGap =
      bothPlayedKnown
        ? Math.abs(
            leader.played! -
            opponent.played!
          )
        : null;

    const bothPpgKnown =
      validNumber(
        leader.pointsPerGame
      ) &&
      validNumber(
        opponent.pointsPerGame
      );

    const ppgGap =
      bothPpgKnown
        ? leader.pointsPerGame! -
          opponent.pointsPerGame!
        : null;

    /*
     * Si el lider tiene peor
     * rendimiento por partido,
     * evitamos marcarlo como
     * superior de forma automatica.
     */
    if (
      ppgGap !== null &&
      ppgGap < -0.05
    ) {
      return null;
    }

    if (
      playedGap !== null &&
      playedGap > 2 &&
      (
        ppgGap === null ||
        ppgGap < 0.15
      )
    ) {
      return null;
    }

    /*
     * Primer filtro:
     * diferencia significativa
     * de puntos Y posiciones.
     */
    if (
      pointsGap < 10 ||
      positionGap < 3
    ) {
      return null;
    }

    const strongTableGap =
      pointsGap >= 15 &&
      positionGap >= 5;

    let level:
      "high" | "watch" =
      strongTableGap &&
      input.dataQuality >= 60
        ? "high"
        : "watch";

    const reasons: string[] = [
      `${leader.name}: ${leader.position}.º, ${leader.points} pts`,
      `${opponent.name}: ${opponent.position}.º, ${opponent.points} pts`,
      `Diferencia: ${pointsGap} puntos y ${positionGap} posiciones`,
    ];

    const warnings: string[] = [];

    if (leadingSide === "home") {
      reasons.push(
        "El equipo mejor clasificado juega de local"
      );
    } else {
      warnings.push(
        "El equipo mejor clasificado juega de visitante"
      );
    }

    if (ppgGap !== null) {
      reasons.push(
        `Ventaja en puntos por partido: ${ppgGap.toFixed(2)}`
      );
    }

    /*
     * La forma reciente ayuda
     * a identificar rivales
     * potencialmente peligrosos.
     */
    if (
      leader.form.length >= 3 &&
      opponent.form.length >= 3
    ) {
      const leaderWins =
        winsInRecentForm(leader);

      const opponentWins =
        winsInRecentForm(opponent);

      reasons.push(
        `Victorias recientes: ${leaderWins} vs ${opponentWins}`
      );

      if (
        opponentWins >= 4 &&
        leaderWins <= 1
      ) {
        warnings.push(
          "El rival presenta mejor forma reciente"
        );

        level = "watch";
      }
    }

    if (!bothPlayedKnown) {
      warnings.push(
        "No se conoce la cantidad de partidos disputados por ambos equipos"
      );

      level = "watch";
    }

    return {
      level,
      leadingSide,
      leadingTeam: leader.name,
      opponentTeam: opponent.name,
      pointsGap,
      positionGap,
      dataQuality: input.dataQuality,
      kickoffAt: input.match.kickoffAt,
      reasons,
      warnings,
    };
  }
}

