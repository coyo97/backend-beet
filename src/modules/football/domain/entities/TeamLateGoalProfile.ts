export interface TeamLateGoalScorer {
  playerId:
    string |
    null;

  playerName:
    string |
    null;

  goals:
    number;

  late80Goals:
    number;

  late90Goals:
    number;
}

export interface TeamLateGoalProfile {
  teamName:
    string;

  /*
   * Partidos que tenemos guardados
   * de este equipo.
   */
  matchesTracked:
    number;

  /*
   * No usamos partidos capturados
   * demasiado pronto como denominador.
   */
  matchesObserved80:
    number;

  matchesObserved90:
    number;

  /*
   * Goles realmente encontrados
   * en las timelines almacenadas.
   */
  recordedGoalsScored:
    number;

  recordedGoalsConceded:
    number;

  late80Scored:
    number;

  late80Conceded:
    number;

  late90Scored:
    number;

  late90Conceded:
    number;

  matchesWithLate80Scored:
    number;

  matchesWithLate80Conceded:
    number;

  matchesWithLate90Scored:
    number;

  matchesWithLate90Conceded:
    number;

  /*
   * % de partidos observados hasta
   * esa ventana donde ocurrió.
   */
  late80ScoringMatchRate:
    number |
    null;

  late80ConcedingMatchRate:
    number |
    null;

  late90ScoringMatchRate:
    number |
    null;

  late90ConcedingMatchRate:
    number |
    null;

  scorers:
    TeamLateGoalScorer[];
}
