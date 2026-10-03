export interface SofascoreStandingTeam {
  id:
    string | null;

  name:
    string;

  shortName:
    string | null;

  slug:
    string | null;
}

export interface SofascoreStandingRow {
  position:
    number | null;

  team:
    SofascoreStandingTeam;

  matches:
    number | null;

  wins:
    number | null;

  draws:
    number | null;

  losses:
    number | null;

  scoresFor:
    number | null;

  scoresAgainst:
    number | null;

  points:
    number | null;

  scoreDifference:
    string | null;
}

/*
 * Selección opcional dentro de una página
 * que contiene varias tablas/grupos/fases.
 *
 * Si tournamentId está presente,
 * la coincidencia debe ser EXACTA.
 */
export interface SofascoreStandingsSelection {
  tournamentId?:
    string | null;
}

export interface SofascoreStandings {
  tournamentName:
    string | null;

  seasonName:
    string | null;

  seasonId:
    string | null;

  rows:
    SofascoreStandingRow[];

  sourceUrl:
    string;

  fetchedAt:
    string;
}
