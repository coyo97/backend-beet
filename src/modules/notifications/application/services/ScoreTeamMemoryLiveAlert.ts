
export interface TeamMemoryPriorityStats {
  wins: number;
  losses: number;
  previousOpponentWins: number;
  previousOpponentLosses: number;
}

function count(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

/*
 * Mismo criterio utilizado por
 * DetectTeamMemoryLiveAlerts.
 */
export function scoreTeamMemoryLiveAlert(
  stats: TeamMemoryPriorityStats
): number {

  const repeatedOpponent =
    count(stats.previousOpponentWins) +
    count(stats.previousOpponentLosses);

  return (
    repeatedOpponent * 100 +
    count(stats.wins) * 10 +
    count(stats.losses)
  );
}

