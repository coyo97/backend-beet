import type {
  SofascoreStandingRow,
  SofascoreStandings,
  SofascoreStandingsSelection,
} from "./SofascoreStandings";

type JsonRecord =
  Record<
    string,
    unknown
  >;

export class SofascoreNextDataStandingsParser {
  public parse(
    raw:
      string,

    sourceUrl:
      string,

    selection:
      SofascoreStandingsSelection =
      {}
  ): SofascoreStandings {

    const payload:
      unknown =
      JSON.parse(
        raw
      );

    const candidates =
      this.findStandings(
        payload
      );

    if (
      candidates.length ===
      0
    ) {
      throw new Error(
        "Sofascore standings not found in __NEXT_DATA__"
      );
    }

    const withRows =
      candidates.filter(
        (
          candidate
        ) =>
          Array.isArray(
            candidate.rows
          )
      );

    if (
      withRows.length ===
      0
    ) {
      throw new Error(
        "Sofascore standings rows not found"
      );
    }

    let selectable =
      withRows;

    /*
     * Si conocemos el tournamentId de la
     * fase/grupo, NO permitimos fallback.
     *
     * Esto evita mostrar una tabla válida
     * pero perteneciente a otro grupo.
     */
    if (
      selection.tournamentId
    ) {
      selectable =
        withRows.filter(
          (
            candidate
          ) =>
            this.getTournamentId(
              candidate
            ) ===
              selection
                .tournamentId
        );

      if (
        selectable.length ===
        0
      ) {
        throw new Error(
          `Sofascore standings not found for tournamentId=${selection.tournamentId}`
        );
      }
    }

    /*
     * Dentro de la fase correcta,
     * preferimos la clasificación "total".
     *
     * Si no se especificó tournamentId,
     * conserva el comportamiento anterior.
     */
    const standing =
      selectable.find(
        (
          candidate
        ) =>
          this.stringValue(
            candidate.type
          ) ===
            "total"
      ) ??
      selectable[0];

    if (!standing) {
      throw new Error(
        "Sofascore standings selection failed"
      );
    }

    const rows =
      Array.isArray(
        standing.rows
      )
        ? standing.rows
            .map(
              (
                value
              ) =>
                this.parseRow(
                  value
                )
            )
            .filter(
              (
                row
              ): row is
                SofascoreStandingRow =>
                  row !==
                  null
            )
        : [];

    const tournament =
      this.asRecord(
        standing.tournament
      );

    const uniqueTournament =
      this.asRecord(
        tournament
          ?.uniqueTournament
      );

    /*
     * Cuando elegimos una fase exacta
     * queremos mostrar el nombre de esa
     * fase/grupo, no solamente el nombre
     * del unique tournament.
     *
     * Ej:
     * CMCL, Final Round South Group
     *
     * en vez de:
     * Chinese Champions League CMCL
     */
    const tournamentName =
      selection.tournamentId
        ? (
            this.stringValue(
              tournament?.name
            ) ??
            this.stringValue(
              uniqueTournament
                ?.name
            )
          )
        : (
            this.stringValue(
              uniqueTournament
                ?.name
            ) ??
            this.stringValue(
              tournament?.name
            )
          );

    return {
      tournamentName,

      seasonName:
        this.stringValue(
          standing.name
        ),

      seasonId:
        this.extractSeasonId(
          sourceUrl
        ),

      rows,

      sourceUrl,

      fetchedAt:
        new Date()
          .toISOString(),
    };
  }

  private getTournamentId(
    standing:
      JsonRecord
  ): string | null {

    const tournament =
      this.asRecord(
        standing.tournament
      );

    return this.stringValue(
      tournament?.id
    );
  }

  private findStandings(
    value:
      unknown,

    depth =
      0
  ): JsonRecord[] {

    if (
      depth >
      10
    ) {
      return [];
    }

    if (
      Array.isArray(
        value
      )
    ) {
      return value.flatMap(
        (
          item
        ) =>
          this.findStandings(
            item,
            depth +
              1
          )
      );
    }

    const record =
      this.asRecord(
        value
      );

    if (!record) {
      return [];
    }

    const result:
      JsonRecord[] =
      [];

    if (
      Array.isArray(
        record.standings
      )
    ) {
      for (
        const item
        of record.standings
      ) {
        const candidate =
          this.asRecord(
            item
          );

        if (
          candidate &&
          Array.isArray(
            candidate.rows
          )
        ) {
          result.push(
            candidate
          );
        }
      }
    }

    for (
      const [
        key,
        child,
      ]
      of Object.entries(
        record
      )
    ) {
      if (
        key ===
        "standings"
      ) {
        continue;
      }

      result.push(
        ...this.findStandings(
          child,
          depth +
            1
        )
      );
    }

    return result;
  }

  private parseRow(
    value:
      unknown
  ): SofascoreStandingRow |
    null {

    const row =
      this.asRecord(
        value
      );

    if (!row) {
      return null;
    }

    const team =
      this.asRecord(
        row.team
      );

    const teamName =
      this.stringValue(
        team?.name
      );

    if (!teamName) {
      return null;
    }

    return {
      position:
        this.numberValue(
          row.position
        ),

      team: {
        id:
          this.stringValue(
            team?.id
          ),

        name:
          teamName,

        shortName:
          this.stringValue(
            team?.shortName
          ),

        slug:
          this.stringValue(
            team?.slug
          ),
      },

      matches:
        this.numberValue(
          row.matches
        ),

      wins:
        this.numberValue(
          row.wins
        ),

      draws:
        this.numberValue(
          row.draws
        ),

      losses:
        this.numberValue(
          row.losses
        ),

      scoresFor:
        this.numberValue(
          row.scoresFor
        ),

      scoresAgainst:
        this.numberValue(
          row.scoresAgainst
        ),

      points:
        this.numberValue(
          row.points
        ),

      scoreDifference:
        this.stringValue(
          row.scoreDiffFormatted
        ),
    };
  }

  private extractSeasonId(
    url:
      string
  ): string | null {

    return url.match(
      /#id:(\d+)/
    )?.[1] ??
      null;
  }

  private asRecord(
    value:
      unknown
  ): JsonRecord | null {

    if (
      !value ||
      typeof value !==
        "object" ||
      Array.isArray(
        value
      )
    ) {
      return null;
    }

    return value as
      JsonRecord;
  }

  private stringValue(
    value:
      unknown
  ): string | null {

    if (
      typeof value ===
      "string"
    ) {
      const trimmed =
        value.trim();

      return trimmed ||
        null;
    }

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return String(
        value
      );
    }

    return null;
  }

  private numberValue(
    value:
      unknown
  ): number | null {

    if (
      typeof value ===
        "number" &&
      Number.isFinite(
        value
      )
    ) {
      return value;
    }

    if (
      typeof value ===
      "string"
    ) {
      const parsed =
        Number(
          value
        );

      return Number.isFinite(
        parsed
      )
        ? parsed
        : null;
    }

    return null;
  }
}
