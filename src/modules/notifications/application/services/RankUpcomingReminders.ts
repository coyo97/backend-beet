
import type {
  DueUpcomingReminder,
} from "./GetDueUpcomingReminders";

/*
 * Ranking de relevancia.
 *
 * No representa una probabilidad
 * de victoria ni una recomendación
 * de apuesta.
 */

function bounded(
  value: number,
  maximum: number
): number {

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(
    Math.abs(value),
    maximum
  );
}

export function upcomingPriorityScore(
  reminder: DueUpcomingReminder
): number {

  const points =
    bounded(reminder.pointsGap, 40);

  const positions =
    bounded(reminder.positionGap, 15);

  const quality =
    Number.isFinite(reminder.dataQuality)
      ? Math.min(
          30,
          Math.max(
            0,
            reminder.dataQuality - 70
          )
        )
      : 0;

  return (
    points * 2 +
    positions * 3 +
    quality
  );
}

export function compareUpcomingReminders(
  a: DueUpcomingReminder,
  b: DueUpcomingReminder
): number {

  /*
   * Priorizar 60m:
   * su ventana válida es más corta.
   */
  if (a.window !== b.window) {
    return a.window === "60m" ? -1 : 1;
  }

  const scoreDifference =
    upcomingPriorityScore(b) -
    upcomingPriorityScore(a);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  /*
   * En igualdad de prioridad,
   * atender primero el aviso
   * más antiguo todavía válido.
   */
  const timeDifference =
    a.dueAt.getTime() -
    b.dueAt.getTime();

  if (timeDifference !== 0) {
    return timeDifference;
  }

  return a.matchKey.localeCompare(
    b.matchKey
  );
}

export function rankUpcomingReminders(
  reminders: readonly DueUpcomingReminder[]
): DueUpcomingReminder[] {

  return [...reminders].sort(
    compareUpcomingReminders
  );
}

