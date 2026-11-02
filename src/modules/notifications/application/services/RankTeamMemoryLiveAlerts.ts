
import type {
  OwnerTeamMemoryLiveAlert,
} from "./FindTeamMemoryLiveAlerts";

import {
  scoreTeamMemoryLiveAlert,
} from "./ScoreTeamMemoryLiveAlert";

/*
 * Ordenar las alertas más relevantes
 * antes de reservar cupos diarios.
 *
 * No modifica el arreglo original.
 */
export function rankTeamMemoryLiveAlerts(
  alerts: readonly OwnerTeamMemoryLiveAlert[]
): OwnerTeamMemoryLiveAlert[] {

  return [...alerts].sort((a, b) => {

    const scoreDifference =
      scoreTeamMemoryLiveAlert(b) -
      scoreTeamMemoryLiveAlert(a);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    /*
     * Desempates deterministas.
     */
    const ownerDifference =
      a.ownerId.localeCompare(b.ownerId);

    if (ownerDifference !== 0) {
      return ownerDifference;
    }

    return a.matchKey.localeCompare(
      b.matchKey
    );
  });
}

