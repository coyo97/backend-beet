export interface OneXBetLiveGame {
  id:
    string;

  championshipId:
    string | null;

  competitionName:
    string;

  countryName:
    string;

  homeId:
    string | null;

  homeName:
    string;

  awayId:
    string | null;

  awayName:
    string;

  homeScore:
    number | null;

  awayScore:
    number | null;

  clock:
    string | null;

  period:
    string | null;

  startAt:
    string | null;

  /*
   * Datos de navegación/detail
   * tomados del MISMO objeto raw
   * estructural del partido.
   */
  gameIdForUrl:
    string | null;

  gameNameForUrl:
    string | null;

  /*
   * Capacidades declaradas por 1xBet.
   */
  hasHeadToHead:
    boolean;

  hasLineups:
    boolean;

  hasTimeline:
    boolean;
}
