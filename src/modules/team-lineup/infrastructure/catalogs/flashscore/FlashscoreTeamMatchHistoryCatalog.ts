import type {
  HistoricalTeamMatch,
  ListRecentTeamMatchesInput,
  TeamMatchHistoryCatalog,
} from "../../../application/ports/TeamMatchHistoryCatalog";

interface RawTeamRef {
  id?:
    string | null;
}

interface RawMatch {
  id?:
    string | null;

  start_time?:
    string | null;

  home?:
    RawTeamRef | null;

  away?:
    RawTeamRef | null;
}

interface RawCompetition {
  matches?:
    RawMatch[];
}

interface RawTeamResultsResponse {
  competitions?:
    RawCompetition[];
}

export class FlashscoreTeamMatchHistoryCatalog
  implements TeamMatchHistoryCatalog
{
  private readonly baseUrl:
    string;

  constructor(
    baseUrl =
      process.env
        .FLASHSCORE_BASE_URL ??
      "http://127.0.0.1:8100"
  ) {

    this.baseUrl =
      baseUrl.replace(
        /\/+$/,
        ""
      );
  }

  public async listRecentFinished(
    input:
      ListRecentTeamMatchesInput
  ): Promise<
    HistoricalTeamMatch[]
  > {

    if (
      input.provider !==
      "flashscore"
    ) {
      throw new Error(
        `Unsupported history provider: ${input.provider}`
      );
    }

    const limit =
      Math.min(
        Math.max(
          Number.isFinite(
            input.limit
          )
            ? Number(
                input.limit
              )
            : 5,
          1
        ),
        8
      );

    const params =
      new URLSearchParams({
        team:
          input.teamId,

        page:
          "1",
      });

    const response =
      await fetch(
        `${this.baseUrl}` +
        "/teams/results?" +
        params.toString()
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Flashscore team results HTTP ${response.status}`
      );
    }

    const data =
      await response.json() as
        RawTeamResultsResponse;

    const matches:
      HistoricalTeamMatch[] =
        [];

    for (
      const competition
      of data.competitions ??
        []
    ) {

      for (
        const raw
        of competition.matches ??
          []
      ) {

        const externalId =
          typeof raw.id ===
            "string"
            ? raw.id.trim()
            : "";

        if (
          !externalId
        ) {
          continue;
        }

        const sourceKey =
          `flashscore:${externalId}`;

        if (
          input
            .excludeSourceKey ===
          sourceKey
        ) {
          continue;
        }

        const homeTeamId =
          typeof raw.home
            ?.id ===
            "string"
            ? raw.home.id
            : null;

        const awayTeamId =
          typeof raw.away
            ?.id ===
            "string"
            ? raw.away.id
            : null;

        /*
         * Seguridad adicional:
         * aunque consultamos resultados
         * de un equipo concreto, exigimos
         * que realmente aparezca en el
         * partido recibido.
         */
        if (
          homeTeamId !==
            input.teamId &&
          awayTeamId !==
            input.teamId
        ) {
          continue;
        }

        matches.push({
          provider:
            "flashscore",

          externalId,

          sourceKey,

          kickoffAt:
            typeof raw
              .start_time ===
              "string"
              ? raw.start_time
              : null,

          homeTeamId,

          awayTeamId,
        });
      }
    }

    /*
     * competitions[] agrupa partidos
     * por torneo, así que volvemos a
     * ordenar globalmente por fecha.
     */
    matches.sort(
      (
        a,
        b
      ) =>
        this.timestamp(
          b.kickoffAt
        ) -
        this.timestamp(
          a.kickoffAt
        )
    );

    /*
     * Un mismo partido no debería aparecer
     * dos veces, pero lo deduplicamos por
     * seguridad.
     */
    const unique =
      new Map<
        string,
        HistoricalTeamMatch
      >();

    for (
      const match
      of matches
    ) {
      if (
        !unique.has(
          match.sourceKey
        )
      ) {
        unique.set(
          match.sourceKey,
          match
        );
      }
    }

    return Array.from(
      unique.values()
    )
      .slice(
        0,
        limit
      );
  }

  private timestamp(
    value:
      string | null
  ): number {

    if (!value) {
      return 0;
    }

    const parsed =
      Date.parse(
        value
      );

    return Number.isFinite(
      parsed
    )
      ? parsed
      : 0;
  }
}
