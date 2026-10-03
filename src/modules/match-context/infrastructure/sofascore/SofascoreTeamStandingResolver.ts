import type {
  SofascoreStandingRow,
} from "../../../football/infrastructure/providers/sofascore-browser/SofascoreStandings";

export class SofascoreTeamStandingResolver {
  public find(
    teamName:
      string,

    rows:
      SofascoreStandingRow[]
  ): SofascoreStandingRow |
    null {

    const wanted =
      this.normalize(
        teamName
      );

    for (
      const row
      of rows
    ) {
      const candidates =
        [
          row.team.name,
          row.team.shortName,
          row.team.slug,
        ]
          .filter(
            (
              value
            ): value is string =>
              Boolean(
                value
              )
          );

      const matches =
        candidates.some(
          (
            candidate
          ) =>
            this.normalize(
              candidate
            ) ===
            wanted
        );

      if (matches) {
        return row;
      }
    }

    return null;
  }

  private normalize(
    value:
      string
  ): string {

    return value
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /\b(fc|cf|fk)\b/g,
        " "
      )
      .replace(
        /[^a-z0-9]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }
}
