import type {
  LiveMatch,
} from "../../../domain/entities/LiveMatch";

import {
  FotMobFixtureCatalog,
} from "./FotMobFixtureCatalog";

import type {
  FotMobFixtureCandidate,
} from "./FotMobFixtureCatalog";

export interface FotMobResolvedMatch {
  externalId:
    string;

  leagueId:
    string | null;

  homeName:
    string;

  awayName:
    string;

  competitionName:
    string;

  confidence:
    number;
}

export class FotMobMatchResolver {
  constructor(
    private readonly catalog:
      FotMobFixtureCatalog
  ) {}

  public async resolve(
    source:
      LiveMatch
  ): Promise<
    FotMobResolvedMatch | null
  > {

    /*
     * IMPORTANTE:
     *
     * Aquí ya NO consultamos FotMob
     * directamente.
     *
     * El catálogo descarga ayer/hoy/mañana
     * una sola vez y mantiene cache.
     */
    const candidates =
      await this.catalog
        .getAll();

    let best:
      FotMobFixtureCandidate | null =
        null;

    let bestScore =
      0;

    for (
      const candidate
      of candidates
    ) {

      const score =
        this.scoreCandidate(
          source,
          candidate
        );

      if (
        score >
        bestScore
      ) {
        bestScore =
          score;

        best =
          candidate;
      }
    }

    /*
     * Preferimos perder una coincidencia
     * antes que enlazar dos partidos
     * diferentes.
     */
    if (
      !best ||
      bestScore <
        0.78
    ) {
      return null;
    }

    return {
      externalId:
        String(
          best.match.id
        ),

      leagueId:
        this.resolveLeagueId(
          best
        ),

      homeName:
        best.match
          .home
          ?.name ??
        "",

      awayName:
        best.match
          .away
          ?.name ??
        "",

      competitionName:
        best.league.name,

      confidence:
        bestScore,
    };
  }

  private scoreCandidate(
    source:
      LiveMatch,

    candidate:
      FotMobFixtureCandidate
  ): number {

    const candidateHome =
      candidate.match
        .home
        ?.name ??
      "";

    const candidateAway =
      candidate.match
        .away
        ?.name ??
      "";

    /*
     * Comparación normal:
     *
     * 1xBet:
     * Persiba
     * Persipura
     *
     * FotMob:
     * Persiba Balikpapan
     * Persipura Jayapura
     */
    const home =
      this.nameSimilarity(
        source.home.name,
        candidateHome
      );

    const away =
      this.nameSimilarity(
        source.away.name,
        candidateAway
      );

    /*
     * Ambos equipos deben tener una
     * similitud razonable.
     */
    if (
      home <
        0.55 ||
      away <
        0.55
    ) {
      return 0;
    }

    const competition =
      this.nameSimilarity(
        source.competition
          .name,

        candidate.league
          .name
      );

    const time =
      this.timeSimilarity(
        source,
        candidate
      );

    /*
     * El nombre de los dos equipos
     * pesa 80%.
     *
     * Liga y horario solo ayudan
     * a confirmar.
     */
    return (
      home *
        0.40 +
      away *
        0.40 +
      competition *
        0.10 +
      time *
        0.10
    );
  }

  private timeSimilarity(
    source:
      LiveMatch,

    candidate:
      FotMobFixtureCandidate
  ): number {

    const sourceTime =
      new Date(
        source.kickoffAt
      ).getTime();

    const candidateUtcTime =
      candidate.match
        .status
        ?.utcTime;

    /*
     * Si FotMob no trae hora,
     * no descartamos el partido.
     */
    if (
      !candidateUtcTime
    ) {
      return 0.5;
    }

    const candidateTime =
      new Date(
        candidateUtcTime
      ).getTime();

    if (
      !Number.isFinite(
        sourceTime
      ) ||
      !Number.isFinite(
        candidateTime
      )
    ) {
      return 0.5;
    }

    const differenceMinutes =
      Math.abs(
        sourceTime -
        candidateTime
      ) /
      60_000;

    if (
      differenceMinutes <=
      20
    ) {
      return 1;
    }

    if (
      differenceMinutes <=
      60
    ) {
      return 0.8;
    }

    if (
      differenceMinutes <=
      180
    ) {
      return 0.5;
    }

    /*
     * En 1xBet algunos kickoffAt pueden
     * ser inferidos a partir del reloj
     * del partido, por eso no usamos 0.
     */
    return 0.2;
  }

  private nameSimilarity(
    left:
      string,

    right:
      string
  ): number {

    const a =
      this.normalize(
        left
      );

    const b =
      this.normalize(
        right
      );

    if (
      !a ||
      !b
    ) {
      return 0;
    }

    if (
      a ===
      b
    ) {
      return 1;
    }

    /*
     * Ejemplo:
     *
     * persipura
     * persipura jayapura
     */
    if (
      a.includes(
        b
      ) ||
      b.includes(
        a
      )
    ) {
      return 0.90;
    }

    const tokensA =
      new Set(
        a.split(
          " "
        )
      );

    const tokensB =
      new Set(
        b.split(
          " "
        )
      );

    let intersection =
      0;

    for (
      const token
      of tokensA
    ) {

      if (
        tokensB.has(
          token
        )
      ) {
        intersection +=
          1;
      }
    }

    const union =
      new Set([
        ...tokensA,
        ...tokensB,
      ]).size;

    if (
      union ===
      0
    ) {
      return 0;
    }

    return intersection /
      union;
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

      /*
       * Sufijos que pueden aparecer
       * distintos entre proveedores.
       */
      .replace(
        /\b(fc|cf|sc|afc|club)\b/g,
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

  private resolveLeagueId(
    candidate:
      FotMobFixtureCandidate
  ): string | null {

    if (
      candidate.match
        .leagueId !==
      undefined
    ) {
      return String(
        candidate.match
          .leagueId
      );
    }

    if (
      candidate.league
        .id !==
      undefined
    ) {
      return String(
        candidate.league
          .id
      );
    }

    if (
      candidate.league
        .primaryId !==
      undefined
    ) {
      return String(
        candidate.league
          .primaryId
      );
    }

    return null;
  }
}
