import type {
  LiveMatch,
  MatchDataAvailability,
  MatchSource,
} from "../entities/LiveMatch";

export class LiveMatchDeduplicator {
  private readonly kickoffToleranceMs =
    20 * 60 * 1000;

  public deduplicate(
    matches: LiveMatch[]
  ): LiveMatch[] {
    const result:
      LiveMatch[] = [];

    for (const match of matches) {
      const index =
        result.findIndex(
          (existing) =>
            this.isSameMatch(
              existing,
              match
            )
        );

      if (index === -1) {
        result.push(match);
        continue;
      }

      result[index] =
        this.merge(
          result[index],
          match
        );
    }

    return result;
  }

  private isSameMatch(
    a: LiveMatch,
    b: LiveMatch
  ): boolean {
    if (
      this.shareExternalId(
        a.sources,
        b.sources
      )
    ) {
      return true;
    }

    if (
      !this.isKickoffClose(
        a.kickoffAt,
        b.kickoffAt
      )
    ) {
      return false;
    }

    if (
      !this.isCountryCompatible(
        a.competition.country,
        b.competition.country
      )
    ) {
      return false;
    }

    const homeSimilarity =
      this.teamSimilarity(
        a.home.name,
        b.home.name
      );

    const awaySimilarity =
      this.teamSimilarity(
        a.away.name,
        b.away.name
      );

    return (
      homeSimilarity >= 0.60 &&
      awaySimilarity >= 0.60
    );
  }

  private shareExternalId(
    a: MatchSource[],
    b: MatchSource[]
  ): boolean {
    return a.some(
      (sourceA) =>
        b.some(
          (sourceB) =>
            sourceA.provider ===
              sourceB.provider &&
            sourceA.externalId ===
              sourceB.externalId
        )
    );
  }

  private isKickoffClose(
    first: string,
    second: string
  ): boolean {
    const a =
      new Date(first)
        .getTime();

    const b =
      new Date(second)
        .getTime();

    if (
      Number.isNaN(a) ||
      Number.isNaN(b)
    ) {
      return false;
    }

    return (
      Math.abs(a - b) <=
      this.kickoffToleranceMs
    );
  }

  private isCountryCompatible(
    first: string,
    second: string
  ): boolean {
    const a =
      this.normalizeName(
        first
      );

    const b =
      this.normalizeName(
        second
      );

    if (
      !a ||
      !b ||
      a === "unknown" ||
      b === "unknown"
    ) {
      return true;
    }

    return a === b;
  }

  private teamSimilarity(
    first:
      string,

    second:
      string
  ): number {

    const a =
      this.tokenizeTeam(
        first
      );

    const b =
      this.tokenizeTeam(
        second
      );

    if (
      a.length ===
        0 ||
      b.length ===
        0
    ) {
      return 0;
    }

    if (
      a.join(" ") ===
      b.join(" ")
    ) {
      return 1;
    }

    /*
     * No usamos únicamente Set/intersection.
     *
     * Algunas fuentes escriben:
     *
     * Yenisey
     * Enisey
     *
     * Krylya
     * Krylia
     *
     * etc.
     *
     * Permitimos una diferencia mínima
     * entre tokens suficientemente largos.
     *
     * Seguimos necesitando:
     *
     * - kickoff compatible
     * - país compatible
     * - local compatible
     * - visitante compatible
     *
     * por lo que esto no convierte el
     * deduplicador en un fuzzy matcher libre.
     */
    const usedB =
      new Set<
        number
      >();

    let matches =
      0;

    for (
      const tokenA
      of a
    ) {

      let matchIndex =
        -1;

      for (
        let index =
          0;

        index <
        b.length;

        index +=
          1
      ) {

        if (
          usedB.has(
            index
          )
        ) {
          continue;
        }

        const tokenB =
          b[index];

        if (
          !this.areTeamTokensEquivalent(
            tokenA,
            tokenB
          )
        ) {
          continue;
        }

        matchIndex =
          index;

        /*
         * Si existe coincidencia exacta,
         * siempre la preferimos sobre una
         * coincidencia fuzzy.
         */
        if (
          tokenA ===
          tokenB
        ) {
          break;
        }
      }

      if (
        matchIndex ===
        -1
      ) {
        continue;
      }

      usedB.add(
        matchIndex
      );

      matches +=
        1;
    }

    return (
      (2 * matches) /
      (
        a.length +
        b.length
      )
    );
  }

  private tokenizeTeam(
    value:
      string
  ): string[] {

    const ignored =
      new Set([
        "fc",
        "cf",
        "sc",
        "ac",
        "fk",
        "club",
        "football",
        "futbol",
      ]);

    const genderSuffixes =
      new Set([
        "w",
        "women",
        "woman",
        "female",
        "ladies",
        "wfc",
        "femenino",
        "femenina",
        "femenil",
        "fem",
      ]);

    /*
     * normalizeName convierte:
     *
     * "Chelsea Women's"
     *
     * en:
     *
     * "chelsea women s"
     *
     * Lo reagrupamos antes de tokenizar.
     */
    const normalized =
      this
        .normalizeName(
          value
        )
        .replace(
          /\bwomen s\b/g,
          "women"
        );

    const tokens =
      normalized
        .split(
          " "
        )
        .filter(
          Boolean
        )
        .filter(
          token =>
            !ignored.has(
              token
            )
        );

    /*
     * Solamente quitamos indicadores de
     * femenino cuando están al FINAL.
     *
     * Así no destruimos nombres legítimos
     * como:
     *
     * W Connection
     *
     * donde la W forma parte del nombre.
     */
    while (
      tokens.length >
        1 &&
      genderSuffixes.has(
        tokens[
          tokens.length -
          1
        ]
      )
    ) {
      tokens.pop();
    }

    return tokens;
  }

  private areTeamTokensEquivalent(
    first:
      string,

    second:
      string
  ): boolean {

    if (
      first ===
      second
    ) {
      return true;
    }

    /*
     * No hacemos fuzzy sobre tokens
     * cortos.
     *
     * Evita asociaciones peligrosas como:
     *
     * FC / AC / U / B / W
     */
    if (
      first.length <
        5 ||
      second.length <
        5
    ) {
      return false;
    }

    /*
     * Si difieren demasiado en longitud
     * no son una simple variante.
     */
    if (
      Math.abs(
        first.length -
        second.length
      ) >
      1
    ) {
      return false;
    }

    /*
     * Una sola inserción, eliminación
     * o sustitución.
     *
     * Ejemplo:
     *
     * yenisey
     * enisey
     *
     * distancia = 1
     */
    return (
      this.levenshteinDistance(
        first,
        second
      ) <=
      1
    );
  }

  private levenshteinDistance(
    first:
      string,

    second:
      string
  ): number {

    if (
      first ===
      second
    ) {
      return 0;
    }

    if (
      first.length ===
      0
    ) {
      return second.length;
    }

    if (
      second.length ===
      0
    ) {
      return first.length;
    }

    let previous =
      Array.from(
        {
          length:
            second.length +
            1,
        },
        (
          _,
          index
        ) =>
          index
      );

    for (
      let i =
        1;

      i <=
      first.length;

      i +=
        1
    ) {

      const current:
        number[] =
        [
          i,
        ];

      for (
        let j =
          1;

        j <=
        second.length;

        j +=
          1
      ) {

        const cost =
          first[
            i -
            1
          ] ===
          second[
            j -
            1
          ]
            ? 0
            : 1;

        current[
          j
        ] =
          Math.min(
            current[
              j -
              1
            ] +
              1,

            previous[
              j
            ] +
              1,

            previous[
              j -
              1
            ] +
              cost
          );
      }

      previous =
        current;
    }

    return previous[
      second.length
    ];
  }

  private normalizeName(
    value:
      string
  ): string {

    return String(
      value ??
      ""
    )
      .normalize(
        "NFD"
      )
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .toLowerCase()
      .replace(
        /ё/g,
        "е"
      )
      .replace(
        /[^a-z0-9\u0400-\u04ff]+/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  }

  private merge(
    first: LiveMatch,
    second: LiveMatch
  ): LiveMatch {
    const primary =
      this.selectPrimary(
        first,
        second
      );

    const secondary =
      primary === first
        ? second
        : first;

    return {
      ...primary,

      sources:
        this.mergeSources(
          first.sources,
          second.sources
        ),

      status: {
        long:
          primary.status.long ||
          secondary.status.long,

        short:
          primary.status.short ||
          secondary.status.short,

        minute:
          primary.status.minute ??
          secondary.status.minute,
      },

      competition: {
        ...primary.competition,

        name:
          primary
            .competition
            .name ||
          secondary
            .competition
            .name,

        country:
          primary
            .competition
            .country ||
          secondary
            .competition
            .country,

        logo:
          primary
            .competition
            .logo ??
          secondary
            .competition
            .logo,

        flag:
          primary
            .competition
            .flag ??
          secondary
            .competition
            .flag,

        season:
          primary
            .competition
            .season ??
          secondary
            .competition
            .season,

        round:
          primary
            .competition
            .round ??
          secondary
            .competition
            .round,
      },

      home: {
        ...primary.home,

        logo:
          primary.home.logo ??
          secondary.home.logo,

        goals:
          primary.home.goals ??
          secondary.home.goals,

        winner:
          primary.home.winner ??
          secondary.home.winner,
      },

      away: {
        ...primary.away,

        logo:
          primary.away.logo ??
          secondary.away.logo,

        goals:
          primary.away.goals ??
          secondary.away.goals,

        winner:
          primary.away.winner ??
          secondary.away.winner,
      },

      dataAvailability:
        this.mergeAvailability(
          first.dataAvailability,
          second.dataAvailability
        ),
    };
  }

  private selectPrimary(
    first: LiveMatch,
    second: LiveMatch
  ): LiveMatch {
    const firstMinute =
      first.status.minute ??
      -1;

    const secondMinute =
      second.status.minute ??
      -1;

    if (
      secondMinute >
      firstMinute
    ) {
      return second;
    }

    if (
      firstMinute >
      secondMinute
    ) {
      return first;
    }

    const firstScore =
      this.availabilityScore(
        first
          .dataAvailability
      );

    const secondScore =
      this.availabilityScore(
        second
          .dataAvailability
      );

    return secondScore >
      firstScore
      ? second
      : first;
  }

  private availabilityScore(
    availability:
      MatchDataAvailability
  ): number {
    return Object
      .values(
        availability
      )
      .filter(Boolean)
      .length;
  }

  private mergeAvailability(
    first:
      MatchDataAvailability,

    second:
      MatchDataAvailability
  ): MatchDataAvailability {
    return {
      score:
        first.score ||
        second.score,

      events:
        first.events ||
        second.events,

      redCards:
        first.redCards ||
        second.redCards,

      statistics:
        first.statistics ||
        second.statistics,

      possession:
        first.possession ||
        second.possession,

      shots:
        first.shots ||
        second.shots,

      corners:
        first.corners ||
        second.corners,

      lineups:
        first.lineups ||
        second.lineups,

      odds:
        first.odds ||
        second.odds,
    };
  }

  private mergeSources(
    first: MatchSource[],
    second: MatchSource[]
  ): MatchSource[] {
    const map =
      new Map<
        string,
        MatchSource
      >();

    for (
      const source
      of [
        ...first,
        ...second,
      ]
    ) {
      const key =
        `${source.provider}:${source.externalId}`;

      map.set(
        key,
        source
      );
    }

    return [
      ...map.values(),
    ];
  }
}
