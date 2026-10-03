import type {
  RedCardRadarMatch,
} from "../entities/RedCardRadarMatch";

import type {
  PressureAnalysis,
} from "../entities/PressureAnalysis";

import type {
  FieldSide,
  RedCardPressureSignal,
} from "../entities/RedCardPressureSignal";

export class RedCardPressureScanner {
  public scan(
    radarMatch:
      RedCardRadarMatch,

    pressure:
      PressureAnalysis
  ):
    RedCardPressureSignal |
    null {

    /*
     * Importante:
     *
     * No contamos automáticamente
     * cualquier tarjeta roja.
     *
     * Una roja podría corresponder
     * a entrenador o miembro del staff.
     *
     * Para una señal fuerte exigimos
     * incidente asociado a jugador.
     */

    const verified =
      radarMatch
        .redCards
        .incidents
        .filter(
          (incident) =>
            (
              incident.side ===
                "home" ||
              incident.side ===
                "away"
            ) &&
            Boolean(
              incident.player
                ?.name
            )
        );

    const homeReds =
      verified.filter(
        (incident) =>
          incident.side ===
          "home"
      ).length;

    const awayReds =
      verified.filter(
        (incident) =>
          incident.side ===
          "away"
      ).length;

    /*
     * Si no tenemos diferencia
     * numérica verificable,
     * no emitimos señal.
     */
    if (
      homeReds ===
      awayReds
    ) {
      return null;
    }

    const disadvantagedSide:
      FieldSide =
        homeReds > awayReds
          ? "home"
          : "away";

    const advantagedSide:
      FieldSide =
        disadvantagedSide ===
        "home"
          ? "away"
          : "home";

    const playerAdvantage =
      Math.abs(
        homeReds -
        awayReds
      );

    /*
     * El equipo con superioridad
     * numérica debe ser además
     * el dominante estadísticamente.
     */
    if (
      pressure.dominantSide !==
      advantagedSide
    ) {
      return null;
    }

    /*
     * "slight" todavía es demasiado
     * débil para generar señal.
     */
    if (
      pressure.level !==
        "clear" &&
      pressure.level !==
        "strong"
    ) {
      return null;
    }

    /*
     * Con datos pobres evitamos
     * producir una señal fuerte.
     */
    if (
      pressure.confidence ===
      "low"
    ) {
      return null;
    }

    return {
      type:
        "RED_CARD_PRESSURE",

      match:
        radarMatch.match,

      disadvantagedSide,

      advantagedSide,

      playerAdvantage,

      redCards: {
        home:
          homeReds,

        away:
          awayReds,

        verifiedPlayerIncidents:
          verified,
      },

      pressure,

      strength:
        pressure.level ===
        "strong"
          ? "strong"
          : "clear",

      reasonCodes: [
        "PLAYER_RED_CARD_IMBALANCE",
        "ADVANTAGED_SIDE_DOMINATING",
      ],
    };
  }
}
