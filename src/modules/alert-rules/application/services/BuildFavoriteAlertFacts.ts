
import type {
  MatchOpportunity,
} from "../../../opportunity-filter/domain/entities/MatchOpportunity";

import type {
  AlertFacts,
  AlertRuleCondition,
  AlertRuleMetric,
} from "../../domain/AlertRule";

/*
 * Metricas que podemos obtener
 * realmente del analizador actual.
 *
 * favoritePressure y
 * favoriteAverageGoals se conectaran
 * cuando tengamos sus fuentes
 * normalizadas y fiables.
 */
const AVAILABLE_METRICS =
  new Set<AlertRuleMetric>([
    "minute",
    "pointGap",
    "positionGap",
    "favoritePosition",
    "favoriteGoalsBehind",
    "favoriteAtHome",
  ]);

export class BuildFavoriteAlertFacts {

  /*
   * Comprobar que una regla utiliza
   * solamente datos que este
   * analizador puede proporcionar.
   */
  public supports(
    condition: AlertRuleCondition
  ): boolean {

    if (condition.kind === "comparison") {
      return AVAILABLE_METRICS.has(
        condition.metric
      );
    }

    return (
      condition.conditions.length > 0 &&
      condition.conditions.every(
        child => this.supports(child)
      )
    );
  }

  /*
   * Devuelve null si no podemos
   * identificar con suficiente
   * confianza a un favorito.
   */
  public build(
    opportunity: MatchOpportunity
  ): AlertFacts | null {

    const isFavorite =
      opportunity.profile ===
        "clear-favorite" ||
      opportunity.profile ===
        "moderate-favorite";

    if (!isFavorite) {
      return null;
    }

    /*
     * Evitar señales basadas en
     * contexto demasiado incompleto.
     */
    if (
      !Number.isFinite(
        opportunity.dataQuality
      ) ||
      opportunity.dataQuality < 55
    ) {
      return null;
    }

    const side =
      opportunity.favoredSide;

    if (
      side !== "home" &&
      side !== "away"
    ) {
      return null;
    }

    const favorite =
      side === "home"
        ? opportunity.home
        : opportunity.away;

    const opponent =
      side === "home"
        ? opportunity.away
        : opportunity.home;

    const favoriteMatchTeam =
      side === "home"
        ? opportunity.match.home
        : opportunity.match.away;

    const opponentMatchTeam =
      side === "home"
        ? opportunity.match.away
        : opportunity.match.home;

    const facts: AlertFacts = {
      favoriteAtHome:
        side === "home",
    };

    const minute =
      opportunity.match.status.minute;

    if (
      typeof minute === "number" &&
      Number.isFinite(minute) &&
      minute >= 0
    ) {
      facts.minute = minute;
    }

    /*
     * Marcador actual:
     *
     * 0 = empate o no va perdiendo
     * 1 = pierde por un gol
     * 2 = pierde por dos goles
     */
    const favoriteGoals =
      favoriteMatchTeam.goals;

    const opponentGoals =
      opponentMatchTeam.goals;

    if (
      typeof favoriteGoals === "number" &&
      typeof opponentGoals === "number" &&
      Number.isFinite(favoriteGoals) &&
      Number.isFinite(opponentGoals)
    ) {
      facts.favoriteGoalsBehind =
        Math.max(
          0,
          opponentGoals - favoriteGoals
        );
    }

    /*
     * Los datos de puntos y
     * posiciones solo se utilizan
     * cuando existe contexto de tabla.
     */
    if (opportunity.hasTable) {

      if (
        typeof favorite.points === "number" &&
        typeof opponent.points === "number" &&
        Number.isFinite(favorite.points) &&
        Number.isFinite(opponent.points)
      ) {
        facts.pointGap =
          favorite.points -
          opponent.points;
      }

      if (
        typeof favorite.position === "number" &&
        Number.isFinite(favorite.position) &&
        favorite.position > 0
      ) {
        facts.favoritePosition =
          favorite.position;
      }

      if (
        typeof favorite.position === "number" &&
        typeof opponent.position === "number" &&
        Number.isFinite(favorite.position) &&
        Number.isFinite(opponent.position) &&
        favorite.position > 0 &&
        opponent.position > 0
      ) {
        facts.positionGap =
          opponent.position -
          favorite.position;
      }
    }

    return facts;
  }
}

